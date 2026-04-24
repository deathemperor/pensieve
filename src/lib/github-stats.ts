// Aggregates the Claude-Code-era totals across all of Loc's owned repos:
// merged-PR count + sum of pre-squash commits per PR.
//
// Why: GitHub's admin-squash-merge collapses the whole feature branch into
// one commit on main, and GH's search API then only sees that one commit.
// A raw `search/commits?q=user:deathemperor` gives you ~600 "landed" commits
// which severely undercounts the Claude-authored branch commits before the
// squash. Per-PR `commits.totalCount` recovers that loss.

export interface ClaudeEraStats {
	prCount: number;
	preSquashCommits: number;
	updatedAt: string;
}

const ERA_START = "2026-01-29T00:00:00Z";

interface OwnedRepo { owner: { login: string }; name: string; pushed_at: string }

async function fetchOwnedRepos(token: string): Promise<OwnedRepo[]> {
	const headers = {
		"User-Agent": "pensieve-site",
		Accept: "application/vnd.github+json",
		Authorization: `Bearer ${token}`,
	};
	const all: OwnedRepo[] = [];
	for (let page = 1; page <= 10; page++) {
		const res = await fetch(
			`https://api.github.com/user/repos?affiliation=owner&per_page=100&page=${page}&sort=pushed`,
			{ headers },
		);
		if (!res.ok) break;
		const chunk = (await res.json()) as OwnedRepo[];
		if (!chunk.length) break;
		all.push(...chunk);
		if (chunk.length < 100) break;
	}
	// Only bother querying repos pushed to after the era start — repos idle
	// since before Jan 29 cannot possibly have merged era-PRs.
	return all.filter((r) => r.pushed_at >= ERA_START);
}

interface PullNode { mergedAt: string | null; commits: { totalCount: number } }
interface GqlResponse {
	data?: { repository?: { pullRequests?: { nodes: PullNode[]; pageInfo: { hasNextPage: boolean; endCursor: string | null } } } };
}

async function sumRepoPrs(token: string, owner: string, name: string): Promise<{ prCount: number; preSquashCommits: number }> {
	let prCount = 0;
	let preSquashCommits = 0;
	let cursor: string | null = null;

	for (let page = 0; page < 10; page++) {
		const query = `query($owner:String!,$name:String!,$cursor:String){repository(owner:$owner,name:$name){pullRequests(first:100,after:$cursor,states:MERGED,orderBy:{field:UPDATED_AT,direction:DESC}){nodes{mergedAt commits{totalCount}} pageInfo{hasNextPage endCursor}}}}`;
		const res = await fetch("https://api.github.com/graphql", {
			method: "POST",
			headers: {
				"User-Agent": "pensieve-site",
				Accept: "application/vnd.github+json",
				Authorization: `Bearer ${token}`,
				"Content-Type": "application/json",
			},
			body: JSON.stringify({ query, variables: { owner, name, cursor } }),
		});
		if (!res.ok) break;
		const json = (await res.json()) as GqlResponse;
		const conn = json?.data?.repository?.pullRequests;
		if (!conn) break;

		let sawOlderThanEra = false;
		for (const pr of conn.nodes) {
			if (!pr.mergedAt) continue;
			if (pr.mergedAt >= ERA_START) {
				prCount++;
				preSquashCommits += pr.commits?.totalCount ?? 1;
			} else {
				sawOlderThanEra = true;
			}
		}
		// PRs are ordered by UPDATED_AT DESC, so once we see a merged-before-era
		// PR, all later pages are older too.
		if (sawOlderThanEra || !conn.pageInfo.hasNextPage) break;
		cursor = conn.pageInfo.endCursor;
	}

	return { prCount, preSquashCommits };
}

export async function aggregateClaudeEraStats(token: string): Promise<ClaudeEraStats> {
	const repos = await fetchOwnedRepos(token);
	let prCount = 0;
	let preSquashCommits = 0;
	for (const repo of repos) {
		try {
			const result = await sumRepoPrs(token, repo.owner.login, repo.name);
			prCount += result.prCount;
			preSquashCommits += result.preSquashCommits;
		} catch (err) {
			console.error("github-stats: repo failed", repo.owner.login, repo.name, err);
		}
	}
	return { prCount, preSquashCommits, updatedAt: new Date().toISOString() };
}
