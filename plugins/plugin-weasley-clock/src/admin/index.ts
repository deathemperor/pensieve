import FeedsPage from "./feeds";
import ApiKeysPage from "./api-keys";

export const pages: Record<string, React.ComponentType> = {
	"/feeds": FeedsPage,
	"/api-keys": ApiKeysPage,
};
