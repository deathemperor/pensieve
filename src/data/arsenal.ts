export type ArsenalPlatform = "macos" | "iphone" | "cli";

export type ArsenalCategory =
	| "ai"
	| "editor"
	| "terminal"
	| "messenger"
	| "finance"
	| "media"
	| "dev"
	| "system"
	| "reading"
	| "journal"
	| "transit"
	| "shopping"
	| "social";

export type ArsenalFrequency = "today" | "this_week" | "this_month" | "rare";

export type ArsenalTier = "wand" | "inventory";

export interface ArsenalItem {
	slug: string;
	title: string;
	platform: ArsenalPlatform;
	category: ArsenalCategory;
	tier: ArsenalTier;
	icon: string;
	homepageUrl: string;
	role: { en: string; vi: string };
	note?: { en: string; vi: string };
	frequency: ArsenalFrequency;
	lastUsedAt?: string;
}

export const ARSENAL_PLATFORMS: ArsenalPlatform[] = ["macos", "iphone", "cli"];

export const ARSENAL_CATEGORIES: ArsenalCategory[] = [
	"ai",
	"editor",
	"terminal",
	"messenger",
	"finance",
	"media",
	"dev",
	"system",
	"reading",
	"journal",
	"transit",
	"shopping",
	"social",
];

export const ARSENAL_FREQUENCIES: ArsenalFrequency[] = [
	"today",
	"this_week",
	"this_month",
	"rare",
];

export const arsenal: ArsenalItem[] = [
	// ============================================================
	// WAND TIER — the 12 daily drivers that earn the hero treatment
	// ============================================================
	{
		slug: "claude",
		title: "Claude Code",
		platform: "cli",
		category: "ai",
		tier: "wand",
		icon: "/arsenal/icons/cli/claude.svg",
		homepageUrl: "https://docs.claude.com/en/docs/claude-code",
		role: { en: "Pair-programmer at the wand-tip", vi: "Bạn lập trình ở đầu đũa" },
		note: {
			en: "Pair-programming partner that ships this very site with me. Replaced three hours of solo grind with sixty minutes of collaboration on most days. The arsenal page exists because of what we built together.",
			vi: "Bạn đồng hành lập trình giúp xây dựng chính trang web này. Thay ba giờ cày một mình bằng sáu mươi phút cộng tác mỗi ngày. Trang vũ khí này tồn tại vì những gì chúng tôi đã làm cùng nhau.",
		},
		frequency: "today",
	},
	{
		slug: "cmux",
		title: "cmux",
		platform: "macos",
		category: "terminal",
		tier: "wand",
		icon: "/arsenal/icons/macos/cmux.png",
		homepageUrl: "https://github.com/anthropic-experimental/cmux",
		role: { en: "Holds Claude in panes while battle continues", vi: "Giữ Claude trong các khung khi trận chiến tiếp diễn" },
		note: {
			en: "tmux purpose-built around Claude Code sessions. Lets parallel agents work in separate panes without losing each other's context. Newer than my coffee this morning, already indispensable.",
			vi: "tmux được xây dựng riêng quanh các phiên Claude Code. Cho phép nhiều agent làm việc song song trong các khung khác nhau mà không lạc mất ngữ cảnh. Còn mới hơn cà phê sáng nay, đã không thể thiếu.",
		},
		frequency: "today",
	},
	{
		slug: "cursor",
		title: "Cursor",
		platform: "macos",
		category: "editor",
		tier: "wand",
		icon: "/arsenal/icons/macos/cursor.png",
		homepageUrl: "https://www.cursor.com/",
		role: { en: "AI-native IDE for the post-IDE era", vi: "IDE bản xứ AI cho thời hậu IDE" },
		note: {
			en: "The IDE I open by default when Claude Code isn't the right shape. Tab completion that actually understands the project, agent mode for the bigger refactors. The unbundling-of-VS-Code era starts here.",
			vi: "IDE tôi mở mặc định khi Claude Code không phải hình thức đúng. Tab hoàn thành thực sự hiểu dự án, chế độ agent cho các tái cấu trúc lớn. Kỷ nguyên tách bó VS Code bắt đầu từ đây.",
		},
		frequency: "this_week",
	},
	{
		slug: "ghostty",
		title: "Ghostty",
		platform: "macos",
		category: "terminal",
		tier: "wand",
		icon: "/arsenal/icons/macos/ghostty.png",
		homepageUrl: "https://ghostty.org/",
		role: { en: "Modern shell vessel — fast, quiet, sharp", vi: "Vỏ bọc shell hiện đại — nhanh, yên, bén" },
		note: {
			en: "Mitchell Hashimoto's terminal — GPU-rendered, zero-config, opinionated about the right things. Replaced iTerm without ceremony six months ago. The terminal that finally feels native.",
			vi: "Terminal của Mitchell Hashimoto — render bằng GPU, không cấu hình, có quan điểm đúng. Thay thế iTerm không cần nghi lễ sáu tháng trước. Terminal cuối cùng cảm giác bản xứ.",
		},
		frequency: "this_week",
	},
	{
		slug: "raycast",
		title: "Raycast",
		platform: "macos",
		category: "system",
		tier: "wand",
		icon: "/arsenal/icons/macos/raycast.png",
		homepageUrl: "https://www.raycast.com/",
		role: { en: "Wandless command surface for the Mac", vi: "Mặt lệnh không cần đũa cho Mac" },
		note: {
			en: "Spotlight if Spotlight had a designer and a roadmap. Window management, clipboard history, snippet expansion, and a thousand custom commands — most of them keyboard-only. Wand for the right hand.",
			vi: "Spotlight nếu Spotlight có nhà thiết kế và lộ trình. Quản lý cửa sổ, lịch sử clipboard, mở rộng đoạn mã, và hàng ngàn lệnh tùy chỉnh — hầu hết chỉ bằng bàn phím. Đũa phép cho tay phải.",
		},
		frequency: "this_week",
	},
	{
		slug: "lunar",
		title: "Lunar",
		platform: "macos",
		category: "system",
		tier: "wand",
		icon: "/arsenal/icons/macos/lunar.png",
		homepageUrl: "https://lunar.fyi/",
		role: { en: "Bends every display to the right intensity", vi: "Uốn mọi màn hình về đúng cường độ" },
		note: {
			en: "Per-display brightness and color-temperature control with a tiny menubar. Turns three different monitors into one coherent setup. Worth every cent it cost.",
			vi: "Điều khiển độ sáng và nhiệt độ màu cho từng màn hình bằng một menubar nhỏ. Biến ba màn hình khác nhau thành một bố cục đồng nhất. Đáng giá từng đồng đã trả.",
		},
		frequency: "today",
	},
	{
		slug: "rectangle",
		title: "Rectangle",
		platform: "macos",
		category: "system",
		tier: "wand",
		icon: "/arsenal/icons/macos/rectangle.png",
		homepageUrl: "https://rectangleapp.com/",
		role: { en: "Snaps windows into discipline", vi: "Vít các cửa sổ vào kỷ luật" },
		note: {
			en: "Spectacle's spiritual successor — keyboard shortcuts for window arrangement that I've muscle-memorized for years. Free, open-source, and gets out of the way. The macOS that should have shipped.",
			vi: "Người kế thừa tinh thần của Spectacle — phím tắt sắp xếp cửa sổ tôi đã thuộc lòng từ nhiều năm. Miễn phí, mã nguồn mở, và biết tránh đường. macOS lẽ ra nên có sẵn.",
		},
		frequency: "this_week",
	},
	{
		slug: "obsidian",
		title: "Obsidian",
		platform: "macos",
		category: "journal",
		tier: "wand",
		icon: "/arsenal/icons/macos/obsidian.png",
		homepageUrl: "https://obsidian.md/",
		role: { en: "Vault of linked thinking", vi: "Kho lưu trữ tư duy có liên kết" },
		note: {
			en: "Where notes that survive the day go. Backlinks, graph view, and a vault that's just markdown files I own. Mac and iPhone in sync, my second brain across both.",
			vi: "Nơi những ghi chú sống sót sau ngày đi đến. Backlink, sơ đồ nối, và một kho chỉ gồm các tệp markdown của tôi. Mac và iPhone đồng bộ, bộ não thứ hai của tôi trên cả hai.",
		},
		frequency: "this_week",
	},
	{
		slug: "day-one",
		title: "Day One",
		platform: "iphone",
		category: "journal",
		tier: "wand",
		icon: "/arsenal/icons/iphone/day-one.png",
		homepageUrl: "https://dayoneapp.com/",
		role: { en: "Locks today into the Pensieve", vi: "Khóa hôm nay vào Pensieve" },
		note: {
			en: "Daily journal that makes the memoir sprint feel possible. Photos, location, weather auto-stamped. The 2026 narrative gets written here first, refined into Pensieve memories second.",
			vi: "Nhật ký hàng ngày khiến chặng nước rút hồi ký cảm giác khả thi. Ảnh, vị trí, thời tiết tự động đóng dấu. Câu chuyện 2026 được viết ở đây trước, tinh chế vào ký ức Pensieve sau.",
		},
		frequency: "this_week",
	},
	{
		slug: "hacki",
		title: "Hacki",
		platform: "iphone",
		category: "reading",
		tier: "wand",
		icon: "/arsenal/icons/iphone/hacki.png",
		homepageUrl: "https://github.com/Livinglist/Hacki",
		role: { en: "Ear pressed to the wires of the Hacker tribe", vi: "Áp tai vào dây dẫn của bộ tộc Hacker" },
		note: {
			en: "Hacker News reader for iPhone — clean, fast, and respects the original threading. The first thing I open during morning coffee. Tribe membership renewed daily.",
			vi: "Trình đọc Hacker News cho iPhone — sạch, nhanh, và tôn trọng cấu trúc luồng gốc. Việc đầu tiên tôi mở khi cà phê sáng. Thẻ thành viên bộ tộc gia hạn mỗi ngày.",
		},
		frequency: "today",
	},
	{
		slug: "zalo",
		title: "Zalo",
		platform: "iphone",
		category: "messenger",
		tier: "wand",
		icon: "/arsenal/icons/iphone/zalo.png",
		homepageUrl: "https://zalo.me/",
		role: { en: "Owl-post to the Vietnamese tribe", vi: "Cú đưa thư của bộ tộc Việt" },
		note: {
			en: "Vietnam's WhatsApp — where family group chats and old high-school threads still live. Cross-platform with a Mac client that surprisingly works. Owl-post for the home country.",
			vi: "WhatsApp của Việt Nam — nơi nhóm chat gia đình và luồng bạn cấp ba xưa vẫn còn. Đa nền tảng với client Mac đáng ngạc nhiên là hoạt động. Cú đưa thư cho quê nhà.",
		},
		frequency: "today",
	},
	{
		slug: "gh",
		title: "gh",
		platform: "cli",
		category: "dev",
		tier: "wand",
		icon: "/arsenal/icons/cli/gh.svg",
		homepageUrl: "https://cli.github.com/",
		role: { en: "Conjures repos, PRs, issues from anywhere", vi: "Triệu hồi repo, PR, issue từ mọi nơi" },
		note: {
			en: "GitHub on the command line — no more leaving the terminal to open a PR. Pairs perfectly with Claude Code's git flows. The friction-free face of GitHub.",
			vi: "GitHub trên dòng lệnh — không còn rời terminal để mở PR. Ghép hoàn hảo với luồng git của Claude Code. Mặt không-ma-sát của GitHub.",
		},
		frequency: "today",
	},

	// ============================================================
	// macOS INVENTORY
	// ============================================================
	{ slug: "google-chrome", title: "Google Chrome", platform: "macos", category: "dev", tier: "inventory", icon: "/arsenal/icons/macos/google-chrome.png", homepageUrl: "https://www.google.com/chrome/", role: { en: "The default-Chrome reality check", vi: "Kiểm tra thực tế Chrome mặc định" }, frequency: "today" },
	{ slug: "zalo-desktop", title: "Zalo (Desktop)", platform: "macos", category: "messenger", tier: "inventory", icon: "/arsenal/icons/macos/zalo-desktop.png", homepageUrl: "https://zalo.me/pc", role: { en: "Mac mirror of the VN tribe owl-post", vi: "Bản sao Mac của cú đưa thư Việt" }, frequency: "today" },
	{ slug: "developer", title: "Developer", platform: "macos", category: "dev", tier: "inventory", icon: "/arsenal/icons/macos/developer.png", homepageUrl: "https://developer.apple.com/", role: { en: "Apple's developer mode toggle", vi: "Công tắc chế độ nhà phát triển của Apple" }, frequency: "today" },
	{ slug: "claude-desktop", title: "Claude (Desktop)", platform: "macos", category: "ai", tier: "inventory", icon: "/arsenal/icons/macos/claude-desktop.png", homepageUrl: "https://claude.com/download", role: { en: "Anthropic's desktop chat — sidebar to Claude Code", vi: "Chat máy tính Anthropic — phụ trợ Claude Code" }, frequency: "today" },
	{ slug: "dato", title: "Dato", platform: "macos", category: "system", tier: "inventory", icon: "/arsenal/icons/macos/dato.png", homepageUrl: "https://sindresorhus.com/dato", role: { en: "Menubar calendar that respects your eye", vi: "Lịch trên menubar tôn trọng mắt bạn" }, frequency: "this_week" },
	{ slug: "firefox", title: "Firefox", platform: "macos", category: "dev", tier: "inventory", icon: "/arsenal/icons/macos/firefox.png", homepageUrl: "https://www.mozilla.org/firefox/", role: { en: "Second-opinion browser for cross-render testing", vi: "Trình duyệt ý-kiến-thứ-hai cho test cross-render" }, frequency: "this_week" },
	{ slug: "cleanshot-x", title: "CleanShot X", platform: "macos", category: "media", tier: "inventory", icon: "/arsenal/icons/macos/cleanshot-x.png", homepageUrl: "https://cleanshot.com/", role: { en: "Screenshot tool that out-screenshots Apple's", vi: "Công cụ chụp màn hình vượt mặt Apple" }, frequency: "this_week" },
	{ slug: "runcat", title: "RunCat", platform: "macos", category: "system", tier: "inventory", icon: "/arsenal/icons/macos/runcat.png", homepageUrl: "https://kyome.io/runcat/", role: { en: "CPU usage as a running cat", vi: "Tải CPU dưới hình con mèo chạy" }, frequency: "this_week" },
	{ slug: "cloudflare-warp", title: "Cloudflare WARP", platform: "macos", category: "system", tier: "inventory", icon: "/arsenal/icons/macos/cloudflare-warp.png", homepageUrl: "https://1.1.1.1/", role: { en: "VPN by the company that hosts this site", vi: "VPN của công ty hosting trang này" }, frequency: "this_week" },
	{ slug: "zen", title: "Zen", platform: "macos", category: "dev", tier: "inventory", icon: "/arsenal/icons/macos/zen.png", homepageUrl: "https://zen-browser.app/", role: { en: "Browser obsessed with the right UX defaults", vi: "Trình duyệt ám ảnh với UX defaults đúng" }, frequency: "this_week" },
	{ slug: "tabtab", title: "TabTab", platform: "macos", category: "system", tier: "inventory", icon: "/arsenal/icons/macos/tabtab.png", homepageUrl: "https://tabtabapp.com/", role: { en: "Better window switching than ⌘-Tab", vi: "Chuyển cửa sổ tốt hơn ⌘-Tab" }, frequency: "this_week" },
	{ slug: "openkey", title: "OpenKey", platform: "macos", category: "system", tier: "inventory", icon: "/arsenal/icons/macos/openkey.png", homepageUrl: "https://openkey.vn/", role: { en: "Vietnamese typing engine for macOS", vi: "Bộ gõ tiếng Việt cho macOS" }, frequency: "this_week" },
	{ slug: "google-chrome-canary", title: "Chrome Canary", platform: "macos", category: "dev", tier: "inventory", icon: "/arsenal/icons/macos/google-chrome-canary.png", homepageUrl: "https://www.google.com/chrome/canary/", role: { en: "Tomorrow's Chrome bugs, today", vi: "Lỗi Chrome ngày mai, hôm nay" }, frequency: "this_week" },
	{ slug: "docker", title: "Docker", platform: "macos", category: "dev", tier: "inventory", icon: "/arsenal/icons/macos/docker.png", homepageUrl: "https://www.docker.com/", role: { en: "Containers for the dev box", vi: "Container cho máy dev" }, frequency: "this_week" },
	{ slug: "google-chrome-beta", title: "Chrome Beta", platform: "macos", category: "dev", tier: "inventory", icon: "/arsenal/icons/macos/google-chrome-beta.png", homepageUrl: "https://www.google.com/chrome/beta/", role: { en: "Tomorrow's Chrome features, today", vi: "Tính năng Chrome ngày mai, hôm nay" }, frequency: "this_week" },
	{ slug: "brave-browser", title: "Brave Browser", platform: "macos", category: "dev", tier: "inventory", icon: "/arsenal/icons/macos/brave-browser.png", homepageUrl: "https://brave.com/", role: { en: "Browser with the ad-blocker built in", vi: "Trình duyệt có sẵn chặn quảng cáo" }, frequency: "this_week" },
	{ slug: "taskbar", title: "Taskbar", platform: "macos", category: "system", tier: "inventory", icon: "/arsenal/icons/macos/taskbar.png", homepageUrl: "https://taskbarapp.com/", role: { en: "Windows-style taskbar for macOS", vi: "Taskbar phong cách Windows cho macOS" }, frequency: "this_week" },
	{ slug: "steam", title: "Steam", platform: "macos", category: "media", tier: "inventory", icon: "/arsenal/icons/macos/steam.png", homepageUrl: "https://store.steampowered.com/", role: { en: "PC game launcher and library", vi: "Cửa hàng và thư viện game PC" }, frequency: "this_week" },
	{ slug: "safari-desktop", title: "Safari (Desktop)", platform: "macos", category: "system", tier: "inventory", icon: "/arsenal/icons/macos/safari-desktop.png", homepageUrl: "https://www.apple.com/safari/", role: { en: "The system browser, occasionally", vi: "Trình duyệt hệ thống, thỉnh thoảng" }, frequency: "this_week" },
	{ slug: "android-studio", title: "Android Studio", platform: "macos", category: "editor", tier: "inventory", icon: "/arsenal/icons/macos/android-studio.png", homepageUrl: "https://developer.android.com/studio", role: { en: "IDE for Android development", vi: "IDE cho phát triển Android" }, frequency: "rare" },
	{ slug: "antigravity", title: "Antigravity", platform: "macos", category: "editor", tier: "inventory", icon: "/arsenal/icons/macos/antigravity.png", homepageUrl: "https://antigravity.google/", role: { en: "Google's AI-native IDE", vi: "IDE bản xứ AI của Google" }, frequency: "rare" },
	{ slug: "battle-net", title: "Battle.net", platform: "macos", category: "media", tier: "inventory", icon: "/arsenal/icons/macos/battle-net.png", homepageUrl: "https://www.blizzard.com/", role: { en: "Blizzard launcher for Diablo runs", vi: "Launcher Blizzard cho các phiên Diablo" }, frequency: "rare" },
	{ slug: "beyond-compare", title: "Beyond Compare", platform: "macos", category: "dev", tier: "inventory", icon: "/arsenal/icons/macos/beyond-compare.png", homepageUrl: "https://www.scootersoftware.com/", role: { en: "File diff and merge tool", vi: "So sánh và gộp tệp" }, frequency: "rare" },
	{ slug: "caffeine", title: "Caffeine", platform: "macos", category: "system", tier: "inventory", icon: "/arsenal/icons/macos/caffeine.png", homepageUrl: "https://intelliscapesolutions.com/apps/caffeine", role: { en: "Keeps the Mac from sleeping", vi: "Giữ Mac không ngủ" }, frequency: "rare" },
	{ slug: "chatgpt-atlas", title: "ChatGPT Atlas", platform: "macos", category: "ai", tier: "inventory", icon: "/arsenal/icons/macos/chatgpt-atlas.png", homepageUrl: "https://openai.com/index/introducing-chatgpt-atlas/", role: { en: "OpenAI's macOS browser experiment", vi: "Thử nghiệm trình duyệt macOS của OpenAI" }, frequency: "rare" },
	{ slug: "coccoc", title: "Cốc Cốc", platform: "macos", category: "dev", tier: "inventory", icon: "/arsenal/icons/macos/coccoc.png", homepageUrl: "https://coccoc.com/", role: { en: "Vietnamese Chromium fork", vi: "Fork Chromium của Việt Nam" }, frequency: "rare" },
	{ slug: "day-one-desktop", title: "Day One (Desktop)", platform: "macos", category: "journal", tier: "inventory", icon: "/arsenal/icons/macos/day-one-desktop.png", homepageUrl: "https://dayoneapp.com/", role: { en: "Daily journal feeding the memoir", vi: "Nhật ký hàng ngày nuôi hồi ký" }, frequency: "rare" },
	{ slug: "discord", title: "Discord", platform: "macos", category: "messenger", tier: "inventory", icon: "/arsenal/icons/macos/discord.png", homepageUrl: "https://discord.com/", role: { en: "Server-based community chat", vi: "Chat cộng đồng dựa trên server" }, frequency: "rare" },
	{ slug: "figma", title: "Figma", platform: "macos", category: "editor", tier: "inventory", icon: "/arsenal/icons/macos/figma.png", homepageUrl: "https://www.figma.com/", role: { en: "Where designs live before they become code", vi: "Nơi thiết kế sống trước khi thành code" }, frequency: "rare" },
	{ slug: "github-desktop", title: "GitHub Desktop", platform: "macos", category: "dev", tier: "inventory", icon: "/arsenal/icons/macos/github-desktop.png", homepageUrl: "https://desktop.github.com/", role: { en: "Git GUI for the days I want one", vi: "GUI git cho ngày muốn dùng GUI" }, frequency: "rare" },
	{ slug: "goose", title: "Goose", platform: "macos", category: "editor", tier: "inventory", icon: "/arsenal/icons/macos/goose.png", homepageUrl: "https://block.github.io/goose/", role: { en: "Block's open-source agent IDE", vi: "IDE agent mã nguồn mở của Block" }, frequency: "rare" },
	{ slug: "iterm", title: "iTerm", platform: "macos", category: "terminal", tier: "inventory", icon: "/arsenal/icons/macos/iterm.png", homepageUrl: "https://iterm2.com/", role: { en: "The terminal Ghostty replaced", vi: "Terminal mà Ghostty đã thay thế" }, frequency: "rare" },
	{ slug: "jellyfin", title: "Jellyfin", platform: "macos", category: "media", tier: "inventory", icon: "/arsenal/icons/macos/jellyfin.png", homepageUrl: "https://jellyfin.org/", role: { en: "Self-hosted media server", vi: "Server media tự host" }, frequency: "rare" },
	{ slug: "jump-desktop", title: "Jump Desktop", platform: "macos", category: "system", tier: "inventory", icon: "/arsenal/icons/macos/jump-desktop.png", homepageUrl: "https://jumpdesktop.com/", role: { en: "Remote desktop for the homelab", vi: "Remote desktop cho homelab" }, frequency: "rare" },
	{ slug: "logioptionsplus", title: "Logi Options+", platform: "macos", category: "system", tier: "inventory", icon: "/arsenal/icons/macos/logioptionsplus.png", homepageUrl: "https://www.logitech.com/software/logi-options-plus.html", role: { en: "Logitech mouse driver", vi: "Driver chuột Logitech" }, frequency: "rare" },
	{ slug: "macwhisper", title: "MacWhisper", platform: "macos", category: "ai", tier: "inventory", icon: "/arsenal/icons/macos/macwhisper.png", homepageUrl: "https://goodsnooze.gumroad.com/l/macwhisper", role: { en: "Whisper transcription with a real GUI", vi: "Phiên âm Whisper với GUI thực" }, frequency: "rare" },
	{ slug: "messenger-desktop", title: "Messenger (Desktop)", platform: "macos", category: "messenger", tier: "inventory", icon: "/arsenal/icons/macos/messenger-desktop.png", homepageUrl: "https://www.messenger.com/desktop", role: { en: "Facebook Messenger Mac client", vi: "Client Mac của Facebook Messenger" }, frequency: "rare" },
	{ slug: "microsoft-edge", title: "Microsoft Edge", platform: "macos", category: "dev", tier: "inventory", icon: "/arsenal/icons/macos/microsoft-edge.png", homepageUrl: "https://www.microsoft.com/edge", role: { en: "Chrome with a different skin", vi: "Chrome với da khác" }, frequency: "rare" },
	{ slug: "microsoft-teams", title: "Microsoft Teams (Desktop)", platform: "macos", category: "messenger", tier: "inventory", icon: "/arsenal/icons/macos/microsoft-teams.png", homepageUrl: "https://www.microsoft.com/microsoft-teams/", role: { en: "Work-mandated meetings", vi: "Họp do công việc bắt buộc" }, frequency: "rare" },
	{ slug: "mindustry", title: "Mindustry", platform: "macos", category: "media", tier: "inventory", icon: "/arsenal/icons/macos/mindustry.png", homepageUrl: "https://mindustrygame.github.io/", role: { en: "Factorio meets tower defense", vi: "Factorio gặp tower defense" }, frequency: "rare" },
	{ slug: "one-task", title: "One Task", platform: "macos", category: "system", tier: "inventory", icon: "/arsenal/icons/macos/one-task.png", homepageUrl: "https://onetask.app/", role: { en: "Single-task focus enforcer", vi: "Bộ thực thi tập trung một việc" }, frequency: "rare" },
	{ slug: "onedrive", title: "OneDrive", platform: "macos", category: "system", tier: "inventory", icon: "/arsenal/icons/macos/onedrive.png", homepageUrl: "https://onedrive.live.com/", role: { en: "Microsoft's cloud sync", vi: "Đồng bộ đám mây Microsoft" }, frequency: "rare" },
	{ slug: "parallels-desktop", title: "Parallels Desktop", platform: "macos", category: "dev", tier: "inventory", icon: "/arsenal/icons/macos/parallels-desktop.png", homepageUrl: "https://www.parallels.com/", role: { en: "Run Windows on Mac when needed", vi: "Chạy Windows trên Mac khi cần" }, frequency: "rare" },
	{ slug: "pdf-images", title: "PDF-Images", platform: "macos", category: "system", tier: "inventory", icon: "/arsenal/icons/macos/pdf-images.png", homepageUrl: "https://apps.apple.com/app/pdf-images/id408291356", role: { en: "Extract images from PDF", vi: "Trích xuất ảnh từ PDF" }, frequency: "rare" },
	{ slug: "plex-media-server", title: "Plex Media Server", platform: "macos", category: "media", tier: "inventory", icon: "/arsenal/icons/macos/plex-media-server.png", homepageUrl: "https://www.plex.tv/", role: { en: "Self-hosted home media server", vi: "Server media gia đình tự host" }, frequency: "rare" },
	{ slug: "postman", title: "Postman", platform: "macos", category: "dev", tier: "inventory", icon: "/arsenal/icons/macos/postman.png", homepageUrl: "https://www.postman.com/", role: { en: "API client for testing endpoints", vi: "Client API để test endpoint" }, frequency: "rare" },
	{ slug: "ppssppsdl", title: "PPSSPP", platform: "macos", category: "media", tier: "inventory", icon: "/arsenal/icons/macos/ppssppsdl.png", homepageUrl: "https://www.ppsspp.org/", role: { en: "PSP emulator", vi: "Trình giả lập PSP" }, frequency: "rare" },
	{ slug: "pullbar", title: "PullBar", platform: "macos", category: "dev", tier: "inventory", icon: "/arsenal/icons/macos/pullbar.png", homepageUrl: "https://github.com/Eldorado234/PullBar", role: { en: "Pull request notifications in menubar", vi: "Thông báo PR trong menubar" }, frequency: "rare" },
	{ slug: "qbittorrent", title: "qBittorrent", platform: "macos", category: "media", tier: "inventory", icon: "/arsenal/icons/macos/qbittorrent.png", homepageUrl: "https://www.qbittorrent.org/", role: { en: "Torrent client", vi: "Client torrent" }, frequency: "rare" },
	{ slug: "retroarch", title: "RetroArch", platform: "macos", category: "media", tier: "inventory", icon: "/arsenal/icons/macos/retroarch.png", homepageUrl: "https://www.retroarch.com/", role: { en: "Multi-system emulator frontend", vi: "Frontend giả lập đa hệ" }, frequency: "rare" },
	{ slug: "sensei", title: "Sensei", platform: "macos", category: "system", tier: "inventory", icon: "/arsenal/icons/macos/sensei.png", homepageUrl: "https://senseiapp.com/", role: { en: "Mac maintenance and stats", vi: "Bảo trì và thống kê Mac" }, frequency: "rare" },
	{ slug: "sid-meier-s-civilization-vi", title: "Civilization VI", platform: "macos", category: "media", tier: "inventory", icon: "/arsenal/icons/macos/sid-meier-s-civilization-vi.png", homepageUrl: "https://civilization.2k.com/civ-vi/", role: { en: "One more turn", vi: "Thêm một lượt nữa" }, frequency: "rare" },
	{ slug: "slack", title: "Slack", platform: "macos", category: "messenger", tier: "inventory", icon: "/arsenal/icons/macos/slack.png", homepageUrl: "https://slack.com/", role: { en: "Work chat for the day job", vi: "Chat công việc cho job ban ngày" }, frequency: "rare" },
	{ slug: "sniffnet", title: "Sniffnet", platform: "macos", category: "dev", tier: "inventory", icon: "/arsenal/icons/macos/sniffnet.png", homepageUrl: "https://sniffnet.net/", role: { en: "Network packet visualizer", vi: "Trực quan hóa gói mạng" }, frequency: "rare" },
	{ slug: "stats", title: "Stats", platform: "macos", category: "system", tier: "inventory", icon: "/arsenal/icons/macos/stats.png", homepageUrl: "https://github.com/exelban/stats", role: { en: "CPU, RAM, network in the menubar", vi: "CPU, RAM, mạng trên menubar" }, frequency: "rare" },
	{ slug: "teamviewer", title: "TeamViewer", platform: "macos", category: "system", tier: "inventory", icon: "/arsenal/icons/macos/teamviewer.png", homepageUrl: "https://www.teamviewer.com/", role: { en: "Remote support for family Macs", vi: "Hỗ trợ từ xa cho Mac gia đình" }, frequency: "rare" },
	{ slug: "telegram-desktop", title: "Telegram (Desktop)", platform: "macos", category: "messenger", tier: "inventory", icon: "/arsenal/icons/macos/telegram-desktop.png", homepageUrl: "https://desktop.telegram.org/", role: { en: "Pro-tier messaging with no FOMO", vi: "Nhắn tin pro-tier không FOMO" }, frequency: "rare" },
	{ slug: "termius", title: "Termius", platform: "macos", category: "terminal", tier: "inventory", icon: "/arsenal/icons/macos/termius.png", homepageUrl: "https://termius.com/", role: { en: "SSH client with synced sessions", vi: "Client SSH với phiên đồng bộ" }, frequency: "rare" },
	{ slug: "the-unarchiver", title: "The Unarchiver", platform: "macos", category: "system", tier: "inventory", icon: "/arsenal/icons/macos/the-unarchiver.png", homepageUrl: "https://theunarchiver.com/", role: { en: "Opens every archive Mac doesn't", vi: "Mở mọi định dạng nén Mac không mở được" }, frequency: "rare" },
	{ slug: "trae", title: "Trae", platform: "macos", category: "editor", tier: "inventory", icon: "/arsenal/icons/macos/trae.png", homepageUrl: "https://www.trae.ai/", role: { en: "ByteDance's AI IDE", vi: "IDE AI của ByteDance" }, frequency: "rare" },
	{ slug: "vampire-survivors", title: "Vampire Survivors", platform: "macos", category: "media", tier: "inventory", icon: "/arsenal/icons/macos/vampire-survivors.png", homepageUrl: "https://poncle.itch.io/vampire-survivors", role: { en: "Indie game with too many demons", vi: "Game indie quá nhiều quỷ" }, frequency: "rare" },
	{ slug: "visual-studio-code", title: "Visual Studio Code", platform: "macos", category: "editor", tier: "inventory", icon: "/arsenal/icons/macos/visual-studio-code.png", homepageUrl: "https://code.visualstudio.com/", role: { en: "The editor everyone defaults to", vi: "Editor mà mọi người dùng mặc định" }, frequency: "rare" },
	{ slug: "vlc", title: "VLC", platform: "macos", category: "media", tier: "inventory", icon: "/arsenal/icons/macos/vlc.png", homepageUrl: "https://www.videolan.org/vlc/", role: { en: "The video player that plays anything", vi: "Trình phát video chạy mọi thứ" }, frequency: "rare" },
	{ slug: "vibetunnel", title: "VibeTunnel", platform: "macos", category: "terminal", tier: "inventory", icon: "/arsenal/icons/macos/vibetunnel.png", homepageUrl: "https://vibetunnel.sh/", role: { en: "Terminal sharing for pair programming", vi: "Chia sẻ terminal cho lập trình cặp" }, frequency: "rare" },
	{ slug: "xcode", title: "Xcode", platform: "macos", category: "editor", tier: "inventory", icon: "/arsenal/icons/macos/xcode.png", homepageUrl: "https://developer.apple.com/xcode/", role: { en: "The Apple-flavored IDE for native iOS", vi: "IDE vị Apple cho công việc iOS" }, frequency: "rare" },

	// ============================================================
	// CLI INVENTORY
	// ============================================================
	{ slug: "ddn", title: "ddn", platform: "cli", category: "dev", tier: "inventory", icon: "/arsenal/icons/cli/ddn.svg", homepageUrl: "https://hasura.io/ddn", role: { en: "Hasura's data delivery network CLI", vi: "CLI mạng phân phối dữ liệu Hasura" }, frequency: "today" },
	{ slug: "helm", title: "helm", platform: "cli", category: "dev", tier: "inventory", icon: "/arsenal/icons/cli/helm.svg", homepageUrl: "https://helm.sh/", role: { en: "Kubernetes package manager", vi: "Trình quản lý gói Kubernetes" }, frequency: "today" },
	{ slug: "yarn", title: "yarn", platform: "cli", category: "dev", tier: "inventory", icon: "/arsenal/icons/cli/yarn.svg", homepageUrl: "https://yarnpkg.com/", role: { en: "Faster npm install", vi: "npm install nhanh hơn" }, frequency: "today" },
	{ slug: "pipenv", title: "pipenv", platform: "cli", category: "dev", tier: "inventory", icon: "/arsenal/icons/cli/pipenv.svg", homepageUrl: "https://pipenv.pypa.io/", role: { en: "Python virtual env manager", vi: "Quản lý môi trường ảo Python" }, frequency: "today" },
	{ slug: "node", title: "node", platform: "cli", category: "dev", tier: "inventory", icon: "/arsenal/icons/cli/node.svg", homepageUrl: "https://nodejs.org/", role: { en: "JavaScript runtime everywhere", vi: "Runtime JavaScript khắp nơi" }, frequency: "today" },
	{ slug: "nvm", title: "nvm", platform: "cli", category: "dev", tier: "inventory", icon: "/arsenal/icons/cli/nvm.svg", homepageUrl: "https://github.com/nvm-sh/nvm", role: { en: "Switch Node versions per project", vi: "Đổi phiên bản Node theo dự án" }, frequency: "today" },
	{ slug: "telnet", title: "telnet", platform: "cli", category: "dev", tier: "inventory", icon: "/arsenal/icons/cli/telnet.svg", homepageUrl: "https://en.wikipedia.org/wiki/Telnet", role: { en: "Old reliable for raw TCP debugging", vi: "Cũ-mà-tin-cậy cho debug TCP thô" }, frequency: "today" },
	{ slug: "serverless", title: "serverless", platform: "cli", category: "dev", tier: "inventory", icon: "/arsenal/icons/cli/serverless.svg", homepageUrl: "https://www.serverless.com/", role: { en: "Deploy lambdas without ceremony", vi: "Deploy lambda không cần nghi lễ" }, frequency: "today" },
	{ slug: "rbenv", title: "rbenv", platform: "cli", category: "dev", tier: "inventory", icon: "/arsenal/icons/cli/rbenv.svg", homepageUrl: "https://github.com/rbenv/rbenv", role: { en: "Ruby version manager", vi: "Quản lý phiên bản Ruby" }, frequency: "this_week" },
	{ slug: "ruby", title: "ruby", platform: "cli", category: "dev", tier: "inventory", icon: "/arsenal/icons/cli/ruby.svg", homepageUrl: "https://www.ruby-lang.org/", role: { en: "Ruby runtime", vi: "Runtime Ruby" }, frequency: "this_week" },
	{ slug: "biome", title: "biome", platform: "cli", category: "dev", tier: "inventory", icon: "/arsenal/icons/cli/biome.svg", homepageUrl: "https://biomejs.dev/", role: { en: "Rust-based JS linter and formatter", vi: "Linter và formatter JS dựa Rust" }, frequency: "this_week" },
	{ slug: "cocoapods", title: "cocoapods", platform: "cli", category: "dev", tier: "inventory", icon: "/arsenal/icons/cli/cocoapods.svg", homepageUrl: "https://cocoapods.org/", role: { en: "Dependency manager for iOS projects", vi: "Quản lý phụ thuộc cho dự án iOS" }, frequency: "this_week" },
	{ slug: "tailscale", title: "tailscale", platform: "cli", category: "system", tier: "inventory", icon: "/arsenal/icons/cli/tailscale.svg", homepageUrl: "https://tailscale.com/", role: { en: "Mesh VPN for personal devices", vi: "VPN mesh cho thiết bị cá nhân" }, frequency: "this_week" },
	{ slug: "wget", title: "wget", platform: "cli", category: "dev", tier: "inventory", icon: "/arsenal/icons/cli/wget.svg", homepageUrl: "https://www.gnu.org/software/wget/", role: { en: "Download files from the command line", vi: "Tải tệp từ dòng lệnh" }, frequency: "this_week" },
	{ slug: "deno", title: "deno", platform: "cli", category: "dev", tier: "inventory", icon: "/arsenal/icons/cli/deno.svg", homepageUrl: "https://deno.com/", role: { en: "Modern JS/TS runtime, Node alternative", vi: "Runtime JS/TS hiện đại, thay thế Node" }, frequency: "this_week" },

	// ============================================================
	// iPhone INVENTORY
	// ============================================================
	{ slug: "settings", title: "Settings", platform: "iphone", category: "system", tier: "inventory", icon: "/arsenal/icons/iphone/settings.png", homepageUrl: "https://www.apple.com/ios/", role: { en: "iOS preferences and switches", vi: "Cài đặt và công tắc iOS" }, frequency: "today" },
	{ slug: "google-maps", title: "Google Maps", platform: "iphone", category: "transit", tier: "inventory", icon: "/arsenal/icons/iphone/google-maps.png", homepageUrl: "https://www.google.com/maps", role: { en: "Where's that café? Google Maps.", vi: "Quán café ở đâu? Google Maps." }, frequency: "today" },
	{ slug: "youtube", title: "YouTube", platform: "iphone", category: "media", tier: "inventory", icon: "/arsenal/icons/iphone/youtube.png", homepageUrl: "https://www.youtube.com/", role: { en: "Long-form video binge surface", vi: "Mặt phẳng cày video dài" }, frequency: "today" },
	{ slug: "safari", title: "Safari", platform: "iphone", category: "system", tier: "inventory", icon: "/arsenal/icons/iphone/safari.png", homepageUrl: "https://www.apple.com/safari/", role: { en: "iOS web browsing", vi: "Lướt web iOS" }, frequency: "today" },
	{ slug: "github-mobile", title: "GitHub", platform: "iphone", category: "dev", tier: "inventory", icon: "/arsenal/icons/iphone/github-mobile.png", homepageUrl: "https://github.com/mobile", role: { en: "Read PRs while standing in line", vi: "Đọc PR khi đứng xếp hàng" }, frequency: "today" },
	{ slug: "reddit", title: "Reddit", platform: "iphone", category: "social", tier: "inventory", icon: "/arsenal/icons/iphone/reddit.png", homepageUrl: "https://www.reddit.com/", role: { en: "Niche community lurking, mostly r/vietnam", vi: "Lén nhìn cộng đồng ngách, chủ yếu r/vietnam" }, frequency: "today" },
	{ slug: "google", title: "Google", platform: "iphone", category: "reading", tier: "inventory", icon: "/arsenal/icons/iphone/google.png", homepageUrl: "https://www.google.com/", role: { en: "Search box for unstructured questions", vi: "Hộp tìm kiếm cho câu hỏi không cấu trúc" }, frequency: "today" },
	{ slug: "messenger", title: "Messenger", platform: "iphone", category: "messenger", tier: "inventory", icon: "/arsenal/icons/iphone/messenger.png", homepageUrl: "https://www.messenger.com/", role: { en: "Facebook Messenger for old contacts", vi: "Facebook Messenger cho liên hệ cũ" }, frequency: "today" },
	{ slug: "claude-mobile", title: "Claude (Mobile)", platform: "iphone", category: "ai", tier: "inventory", icon: "/arsenal/icons/iphone/claude-mobile.png", homepageUrl: "https://claude.com/", role: { en: "Anthropic's chat in pocket form", vi: "Chat Anthropic ở dạng bỏ túi" }, frequency: "today" },
	{ slug: "google-photos", title: "Google Photos", platform: "iphone", category: "media", tier: "inventory", icon: "/arsenal/icons/iphone/google-photos.png", homepageUrl: "https://www.google.com/photos/about/", role: { en: "Cloud backup of every photo taken", vi: "Sao lưu đám mây cho mọi ảnh chụp" }, frequency: "today" },
	{ slug: "vnexpress", title: "VnExpress", platform: "iphone", category: "reading", tier: "inventory", icon: "/arsenal/icons/iphone/vnexpress.png", homepageUrl: "https://vnexpress.net/", role: { en: "Vietnam's daily news of record", vi: "Báo ngày của Việt Nam" }, frequency: "today" },
	{ slug: "photos", title: "Photos", platform: "iphone", category: "media", tier: "inventory", icon: "/arsenal/icons/iphone/photos.png", homepageUrl: "https://www.apple.com/ios/photos/", role: { en: "iOS photo library — 277GB and counting", vi: "Thư viện ảnh iOS — 277GB và đang tăng" }, frequency: "today" },
	{ slug: "facebook", title: "Facebook", platform: "iphone", category: "social", tier: "inventory", icon: "/arsenal/icons/iphone/facebook.png", homepageUrl: "https://www.facebook.com/", role: { en: "Long-form VN narratives that feed Pensieve", vi: "Câu chuyện Việt dài-form nuôi Pensieve" }, frequency: "today" },
	{ slug: "music", title: "Music", platform: "iphone", category: "media", tier: "inventory", icon: "/arsenal/icons/iphone/music.png", homepageUrl: "https://www.apple.com/apple-music/", role: { en: "Apple Music library", vi: "Thư viện Apple Music" }, frequency: "today" },
	{ slug: "camera", title: "Camera", platform: "iphone", category: "media", tier: "inventory", icon: "/arsenal/icons/iphone/camera.png", homepageUrl: "https://www.apple.com/ios/", role: { en: "iOS camera, the obvious one", vi: "Camera iOS, cái rõ ràng" }, frequency: "today" },
	{ slug: "phone", title: "Phone", platform: "iphone", category: "system", tier: "inventory", icon: "/arsenal/icons/iphone/phone.png", homepageUrl: "https://www.apple.com/ios/", role: { en: "It still makes calls", vi: "Vẫn còn gọi điện thoại" }, frequency: "today" },
	{ slug: "clock", title: "Clock", platform: "iphone", category: "system", tier: "inventory", icon: "/arsenal/icons/iphone/clock.png", homepageUrl: "https://www.apple.com/ios/", role: { en: "Timer, alarm, world clock", vi: "Hẹn giờ, báo thức, đồng hồ thế giới" }, frequency: "today" },
	{ slug: "find-my", title: "Find My", platform: "iphone", category: "system", tier: "inventory", icon: "/arsenal/icons/iphone/find-my.png", homepageUrl: "https://www.apple.com/icloud/find-my/", role: { en: "Where's the laptop? Where's the AirPods?", vi: "Laptop đâu? AirPods đâu?" }, frequency: "today" },
	{ slug: "techcombank", title: "Techcombank", platform: "iphone", category: "finance", tier: "inventory", icon: "/arsenal/icons/iphone/techcombank.png", homepageUrl: "https://www.techcombank.com.vn/", role: { en: "Primary VN banking", vi: "Ngân hàng VN chính" }, frequency: "today" },
	{ slug: "linkedin", title: "LinkedIn", platform: "iphone", category: "social", tier: "inventory", icon: "/arsenal/icons/iphone/linkedin.png", homepageUrl: "https://www.linkedin.com/", role: { en: "Professional network, occasionally", vi: "Mạng nghề nghiệp, thỉnh thoảng" }, frequency: "today" },
	{ slug: "telegram", title: "Telegram", platform: "iphone", category: "messenger", tier: "inventory", icon: "/arsenal/icons/iphone/telegram.png", homepageUrl: "https://telegram.org/", role: { en: "Pro-tier messaging with no FOMO", vi: "Nhắn tin pro-tier không FOMO" }, frequency: "today" },
	{ slug: "calendar", title: "Calendar", platform: "iphone", category: "system", tier: "inventory", icon: "/arsenal/icons/iphone/calendar.png", homepageUrl: "https://www.apple.com/ios/", role: { en: "iOS calendar synced to everywhere", vi: "Lịch iOS đồng bộ khắp nơi" }, frequency: "today" },
	{ slug: "gmail", title: "Gmail", platform: "iphone", category: "messenger", tier: "inventory", icon: "/arsenal/icons/iphone/gmail.png", homepageUrl: "https://mail.google.com/", role: { en: "Email when Mail isn't enough", vi: "Email khi Mail không đủ" }, frequency: "today" },
	{ slug: "daily-mail", title: "Daily Mail", platform: "iphone", category: "reading", tier: "inventory", icon: "/arsenal/icons/iphone/daily-mail.png", homepageUrl: "https://www.dailymail.co.uk/", role: { en: "British tabloid, guilty pleasure", vi: "Báo lá cải Anh, thú vui tội lỗi" }, frequency: "today" },
	{ slug: "grab", title: "Grab", platform: "iphone", category: "transit", tier: "inventory", icon: "/arsenal/icons/iphone/grab.png", homepageUrl: "https://www.grab.com/vn/", role: { en: "Grab a ride or grab some food", vi: "Đặt xe hoặc đặt đồ ăn" }, frequency: "today" },
	{ slug: "messages", title: "Messages", platform: "iphone", category: "messenger", tier: "inventory", icon: "/arsenal/icons/iphone/messages.png", homepageUrl: "https://www.apple.com/ios/messages/", role: { en: "iMessage for the Apple-only contacts", vi: "iMessage cho liên hệ chỉ dùng Apple" }, frequency: "today" },
	{ slug: "x-twitter", title: "X", platform: "iphone", category: "social", tier: "inventory", icon: "/arsenal/icons/iphone/x-twitter.png", homepageUrl: "https://x.com/", role: { en: "Formerly Twitter, still doom-scroll", vi: "Trước là Twitter, vẫn doom-scroll" }, frequency: "this_week" },
	{ slug: "livescore", title: "LiveScore", platform: "iphone", category: "reading", tier: "inventory", icon: "/arsenal/icons/iphone/livescore.png", homepageUrl: "https://www.livescore.com/", role: { en: "Football scores in real-time", vi: "Tỷ số bóng đá thời gian thực" }, frequency: "this_week" },
	{ slug: "obsidian-mobile", title: "Obsidian (Mobile)", platform: "iphone", category: "journal", tier: "inventory", icon: "/arsenal/icons/iphone/obsidian-mobile.png", homepageUrl: "https://obsidian.md/", role: { en: "Vault on the go", vi: "Kho lưu trữ trên đường" }, frequency: "this_week" },
	{ slug: "facetime", title: "FaceTime", platform: "iphone", category: "messenger", tier: "inventory", icon: "/arsenal/icons/iphone/facetime.png", homepageUrl: "https://www.apple.com/facetime/", role: { en: "Video calls when distance matters", vi: "Cuộc gọi video khi khoảng cách quan trọng" }, frequency: "this_week" },
	{ slug: "whatsapp", title: "WhatsApp", platform: "iphone", category: "messenger", tier: "inventory", icon: "/arsenal/icons/iphone/whatsapp.png", homepageUrl: "https://www.whatsapp.com/", role: { en: "International contacts who refuse Telegram", vi: "Liên hệ quốc tế từ chối Telegram" }, frequency: "this_week" },
	{ slug: "octal", title: "Octal", platform: "iphone", category: "reading", tier: "inventory", icon: "/arsenal/icons/iphone/octal.png", homepageUrl: "https://octal.app/", role: { en: "Hacker News alternative reader", vi: "Trình đọc HN thay thế" }, frequency: "this_week" },
	{ slug: "speedtest", title: "Speedtest", platform: "iphone", category: "system", tier: "inventory", icon: "/arsenal/icons/iphone/speedtest.png", homepageUrl: "https://www.speedtest.net/", role: { en: "Is the wifi broken or am I", vi: "Wifi hỏng hay là tôi" }, frequency: "this_week" },
	{ slug: "mail", title: "Mail", platform: "iphone", category: "messenger", tier: "inventory", icon: "/arsenal/icons/iphone/mail.png", homepageUrl: "https://www.apple.com/ios/", role: { en: "iOS Mail for second-tier accounts", vi: "Mail iOS cho tài khoản hạng hai" }, frequency: "this_week" },
	{ slug: "slack-mobile", title: "Slack (Mobile)", platform: "iphone", category: "messenger", tier: "inventory", icon: "/arsenal/icons/iphone/slack-mobile.png", homepageUrl: "https://slack.com/", role: { en: "Work chat in pocket form", vi: "Chat công việc dạng bỏ túi" }, frequency: "this_week" },
	{ slug: "teams", title: "Teams (Mobile)", platform: "iphone", category: "messenger", tier: "inventory", icon: "/arsenal/icons/iphone/teams.png", homepageUrl: "https://www.microsoft.com/microsoft-teams/", role: { en: "Work-mandated meetings, mobile", vi: "Họp công việc bắt buộc, mobile" }, frequency: "this_week" },
	{ slug: "app-store", title: "App Store", platform: "iphone", category: "shopping", tier: "inventory", icon: "/arsenal/icons/iphone/app-store.png", homepageUrl: "https://www.apple.com/app-store/", role: { en: "Where new apps come from", vi: "Nơi app mới đến" }, frequency: "this_week" },
	{ slug: "momo", title: "MoMo", platform: "iphone", category: "finance", tier: "inventory", icon: "/arsenal/icons/iphone/momo.png", homepageUrl: "https://momo.vn/", role: { en: "Vietnamese payment wallet", vi: "Ví thanh toán Việt" }, frequency: "this_week" },
	{ slug: "uob-tmrw", title: "UOB TMRW VN", platform: "iphone", category: "finance", tier: "inventory", icon: "/arsenal/icons/iphone/uob-tmrw.png", homepageUrl: "https://www.uob.com.vn/personal/digital-banking/uob-tmrw.page", role: { en: "Secondary VN banking", vi: "Ngân hàng VN phụ" }, frequency: "this_week" },
	{ slug: "wyze", title: "Wyze", platform: "iphone", category: "system", tier: "inventory", icon: "/arsenal/icons/iphone/wyze.png", homepageUrl: "https://www.wyze.com/", role: { en: "Smart home cameras and devices", vi: "Camera và thiết bị nhà thông minh" }, frequency: "rare" },
];
