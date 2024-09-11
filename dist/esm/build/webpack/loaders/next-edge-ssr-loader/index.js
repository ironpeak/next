import { getModuleBuildInfo } from "../get-module-build-info";
import { WEBPACK_RESOURCE_QUERIES } from "../../../../lib/constants";
import { RouteKind } from "../../../../server/future/route-kind";
import { normalizePagePath } from "../../../../shared/lib/page-path/normalize-page-path";
import { loadEntrypoint } from "../../../load-entrypoint";
/*
For pages SSR'd at the edge, we bundle them with the ESM version of Next in order to
benefit from the better tree-shaking and thus, smaller bundle sizes.

The absolute paths for _app, _error and _document, used in this loader, link to the regular CJS modules.
They are generated in `createPagesMapping` where we don't have access to `isEdgeRuntime`,
so we have to do it here. It's not that bad because it keeps all references to ESM modules magic in this place.
*/ function swapDistFolderWithEsmDistFolder(path) {
    return path.replace("next/dist/pages", "next/dist/esm/pages");
}
function getRouteModuleOptions(page) {
    const options = {
        definition: {
            kind: RouteKind.PAGES,
            page: normalizePagePath(page),
            pathname: page,
            // The following aren't used in production.
            bundlePath: "",
            filename: ""
        }
    };
    return options;
}
const edgeSSRLoader = async function edgeSSRLoader() {
    const { dev, page, absolutePagePath, absoluteAppPath, absoluteDocumentPath, absolute500Path, absoluteErrorPath, isServerComponent, stringifiedConfig: stringifiedConfigBase64, appDirLoader: appDirLoaderBase64, pagesType, sriEnabled, cacheHandler, preferredRegion, middlewareConfig: middlewareConfigBase64, serverActions } = this.getOptions();
    const middlewareConfig = JSON.parse(Buffer.from(middlewareConfigBase64, "base64").toString());
    const stringifiedConfig = Buffer.from(stringifiedConfigBase64 || "", "base64").toString();
    const appDirLoader = Buffer.from(appDirLoaderBase64 || "", "base64").toString();
    const isAppDir = pagesType === "app";
    const buildInfo = getModuleBuildInfo(this._module);
    buildInfo.nextEdgeSSR = {
        isServerComponent,
        page: page,
        isAppDir
    };
    buildInfo.route = {
        page,
        absolutePagePath,
        preferredRegion,
        middlewareConfig
    };
    const pagePath = this.utils.contextify(this.context || this.rootContext, absolutePagePath);
    const appPath = this.utils.contextify(this.context || this.rootContext, swapDistFolderWithEsmDistFolder(absoluteAppPath));
    const errorPath = this.utils.contextify(this.context || this.rootContext, swapDistFolderWithEsmDistFolder(absoluteErrorPath));
    const documentPath = this.utils.contextify(this.context || this.rootContext, swapDistFolderWithEsmDistFolder(absoluteDocumentPath));
    const userland500Path = absolute500Path ? this.utils.contextify(this.context || this.rootContext, swapDistFolderWithEsmDistFolder(absolute500Path)) : null;
    const stringifiedPagePath = JSON.stringify(pagePath);
    const pageModPath = `${appDirLoader}${stringifiedPagePath.substring(1, stringifiedPagePath.length - 1)}${isAppDir ? `?${WEBPACK_RESOURCE_QUERIES.edgeSSREntry}` : ""}`;
    if (isAppDir) {
        return await loadEntrypoint("edge-ssr-app", {
            VAR_USERLAND: pageModPath,
            VAR_PAGE: page
        }, {
            sriEnabled: JSON.stringify(sriEnabled),
            nextConfig: stringifiedConfig,
            isServerComponent: JSON.stringify(isServerComponent),
            dev: JSON.stringify(dev),
            serverActions: typeof serverActions === "undefined" ? "undefined" : JSON.stringify(serverActions)
        }, {
            incrementalCacheHandler: cacheHandler ?? null
        });
    } else {
        return await loadEntrypoint("edge-ssr", {
            VAR_USERLAND: pageModPath,
            VAR_PAGE: page,
            VAR_MODULE_DOCUMENT: documentPath,
            VAR_MODULE_APP: appPath,
            VAR_MODULE_GLOBAL_ERROR: errorPath
        }, {
            pagesType: JSON.stringify(pagesType),
            sriEnabled: JSON.stringify(sriEnabled),
            nextConfig: stringifiedConfig,
            dev: JSON.stringify(dev),
            pageRouteModuleOptions: JSON.stringify(getRouteModuleOptions(page)),
            errorRouteModuleOptions: JSON.stringify(getRouteModuleOptions("/_error")),
            user500RouteModuleOptions: JSON.stringify(getRouteModuleOptions("/500"))
        }, {
            userland500Page: userland500Path,
            incrementalCacheHandler: cacheHandler ?? null
        });
    }
};
export default edgeSSRLoader;

//# sourceMappingURL=index.js.map