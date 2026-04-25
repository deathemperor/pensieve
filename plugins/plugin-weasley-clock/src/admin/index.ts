import FeedsPage from "./feeds";
import ApiKeysPage from "./api-keys";
import WebhooksPage from "./webhooks";

export const pages: Record<string, React.ComponentType> = {
	"/feeds": FeedsPage,
	"/api-keys": ApiKeysPage,
	"/webhooks": WebhooksPage,
};
