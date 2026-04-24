// Aggregates the Claude-Code-era totals across every repo the auth token
// can see — personal, collaborator, and org — by searching for PRs authored
// by deathemperor and merged since 2026-01-29.
//
// Why search instead of walking owned repos: search covers all affiliations
// uniformly (huuloc.com's owned repos had 60 PRs; papaya-insurtech org had
// 377) and naturally scopes to PRs Loc personally authored — the honest
// "work I did" filter for mixed-authorship org repos.
//
// Why per-PR commit counts instead of `/search/commits` totals: admin-squash
// merge collapses whole feature branches to one commit on main, so the
// commit-level search undercounts by several-fold. `pullRequest.commits.
// totalCount` recovers what was on the branch at merge time.

export interface ClaudeEraStats {
	prCount: number;
	preSquashCommits: number;
	updatedAt: string;
}

const SEARCH_QUERY = "author:deathemperor is:pr is:merged merged:>=2026-01-29";

interface SearchResponse {
	data?: {
		search?: {
			pageInfo: { hasNextPage: boolean; endCursor: string | null };
			nodes: Array<{ commits?: { totalCount: number } } | null>;
		};
	};
	errors?: unknown;
}

export async function aggregateClaudeEraStats(token: string): Promise<ClaudeEraStats> {
	let prCount = 0;
	let preSquashCommits = 0;
	let cursor: string | null = null;

	for (let page = 0; page < 20; page++) {
		const query = `query($cursor:String){search(query:"${SEARCH_QUERY}",type:ISSUE,first:100,after:$cursor){pageInfo{hasNextPage endCursor} nodes{...on PullRequest{commits{totalCount}}}}}`;
		const res = await fetch("https://api.github.com/graphql", {
			method: "POST",
			headers: {
				"User-Agent": "pensieve-site",
				Accept: "application/vnd.github+json",
				Authorization: `Bearer ${token}`,
				"Content-Type": "application/json",
			},
			body: JSON.stringify({ query, variables: { cursor } }),
		});
		if (!res.ok) break;
		const json = (await res.json()) as SearchResponse;
		const conn = json?.data?.search;
		if (!conn) break;

		for (const node of conn.nodes) {
			if (!node?.commits) continue;
			prCount++;
			preSquashCommits += node.commits.totalCount;
		}
		if (!conn.pageInfo.hasNextPage) break;
		cursor = conn.pageInfo.endCursor;
	}

	return { prCount, preSquashCommits, updatedAt: new Date().toISOString() };
}
