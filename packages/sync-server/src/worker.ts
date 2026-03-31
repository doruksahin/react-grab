import { createApp } from "./app.js";
import { injectRepos } from "./middleware/inject-repos.js";

export default createApp({ middleware: [injectRepos] });
