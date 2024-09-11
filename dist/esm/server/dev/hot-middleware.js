// Based on https://github.com/webpack-contrib/webpack-hot-middleware/blob/9708d781ae0e46179cf8ea1a94719de4679aaf53/middleware.js
// Included License below
// Copyright JS Foundation and other contributors
// Permission is hereby granted, free of charge, to any person obtaining
// a copy of this software and associated documentation files (the
// 'Software'), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to
// permit persons to whom the Software is furnished to do so, subject to
// the following conditions:
// The above copyright notice and this permission notice shall be
// included in all copies or substantial portions of the Software.
// THE SOFTWARE IS PROVIDED 'AS IS', WITHOUT WARRANTY OF ANY KIND,
// EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
// IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY
// CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT,
// TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE
// SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
import { isMiddlewareFilename } from "../../build/utils";
import { HMR_ACTIONS_SENT_TO_BROWSER } from "./hot-reloader-types";
function isMiddlewareStats(stats) {
    for (const key of stats.compilation.entrypoints.keys()){
        if (isMiddlewareFilename(key)) {
            return true;
        }
    }
    return false;
}
function statsToJson(stats) {
    if (!stats) return {};
    return stats.toJson({
        all: false,
        errors: true,
        hash: true,
        warnings: true
    });
}
function getStatsForSyncEvent(clientStats, serverStats) {
    if (!clientStats) return serverStats == null ? void 0 : serverStats.stats;
    if (!serverStats) return clientStats == null ? void 0 : clientStats.stats;
    // Prefer the server compiler stats if it has errors.
    // Otherwise we may end up in a state where the client compilation is the latest but without errors.
    // This causes the error overlay to not display the build error.
    if (serverStats.stats.hasErrors()) {
        return serverStats.stats;
    }
    // Return the latest stats
    return serverStats.ts > clientStats.ts ? serverStats.stats : clientStats.stats;
}
class EventStream {
    constructor(){
        this.clients = new Set();
    }
    everyClient(fn) {
        for (const client of this.clients){
            fn(client);
        }
    }
    close() {
        this.everyClient((client)=>{
            client.close();
        });
        this.clients.clear();
    }
    handler(client) {
        this.clients.add(client);
        client.addEventListener("close", ()=>{
            this.clients.delete(client);
        });
    }
    publish(payload) {
        this.everyClient((client)=>{
            client.send(JSON.stringify(payload));
        });
    }
}
export class WebpackHotMiddleware {
    constructor(compilers, versionInfo){
        this.onClientInvalid = ()=>{
            var _this_serverLatestStats;
            if (this.closed || ((_this_serverLatestStats = this.serverLatestStats) == null ? void 0 : _this_serverLatestStats.stats.hasErrors())) return;
            this.publish({
                action: HMR_ACTIONS_SENT_TO_BROWSER.BUILDING
            });
        };
        this.onClientDone = (statsResult)=>{
            var _this_serverLatestStats;
            this.clientLatestStats = {
                ts: Date.now(),
                stats: statsResult
            };
            if (this.closed || ((_this_serverLatestStats = this.serverLatestStats) == null ? void 0 : _this_serverLatestStats.stats.hasErrors())) return;
            this.publishStats(statsResult);
        };
        this.onServerInvalid = ()=>{
            var _this_serverLatestStats, _this_clientLatestStats;
            if (!((_this_serverLatestStats = this.serverLatestStats) == null ? void 0 : _this_serverLatestStats.stats.hasErrors())) return;
            this.serverLatestStats = null;
            if ((_this_clientLatestStats = this.clientLatestStats) == null ? void 0 : _this_clientLatestStats.stats) {
                this.publishStats(this.clientLatestStats.stats);
            }
        };
        this.onServerDone = (statsResult)=>{
            if (this.closed) return;
            if (statsResult.hasErrors()) {
                this.serverLatestStats = {
                    ts: Date.now(),
                    stats: statsResult
                };
                this.publishStats(statsResult);
            }
        };
        this.onEdgeServerInvalid = ()=>{
            var _this_middlewareLatestStats, _this_clientLatestStats;
            if (!((_this_middlewareLatestStats = this.middlewareLatestStats) == null ? void 0 : _this_middlewareLatestStats.stats.hasErrors())) return;
            this.middlewareLatestStats = null;
            if ((_this_clientLatestStats = this.clientLatestStats) == null ? void 0 : _this_clientLatestStats.stats) {
                this.publishStats(this.clientLatestStats.stats);
            }
        };
        this.onEdgeServerDone = (statsResult)=>{
            if (!isMiddlewareStats(statsResult)) {
                this.onServerInvalid();
                this.onServerDone(statsResult);
                return;
            }
            if (statsResult.hasErrors()) {
                this.middlewareLatestStats = {
                    ts: Date.now(),
                    stats: statsResult
                };
                this.publishStats(statsResult);
            }
        };
        /**
   * To sync we use the most recent stats but also we append middleware
   * errors. This is because it is possible that middleware fails to compile
   * and we still want to show the client overlay with the error while
   * the error page should be rendered just fine.
   */ this.onHMR = (client)=>{
            if (this.closed) return;
            this.eventStream.handler(client);
            const syncStats = getStatsForSyncEvent(this.clientLatestStats, this.serverLatestStats);
            if (syncStats) {
                var _this_middlewareLatestStats;
                const stats = statsToJson(syncStats);
                const middlewareStats = statsToJson((_this_middlewareLatestStats = this.middlewareLatestStats) == null ? void 0 : _this_middlewareLatestStats.stats);
                this.publish({
                    action: HMR_ACTIONS_SENT_TO_BROWSER.SYNC,
                    hash: stats.hash,
                    errors: [
                        ...stats.errors || [],
                        ...middlewareStats.errors || []
                    ],
                    warnings: [
                        ...stats.warnings || [],
                        ...middlewareStats.warnings || []
                    ],
                    versionInfo: this.versionInfo
                });
            }
        };
        this.publishStats = (statsResult)=>{
            const stats = statsResult.toJson({
                all: false,
                hash: true,
                warnings: true,
                errors: true,
                moduleTrace: true
            });
            this.publish({
                action: HMR_ACTIONS_SENT_TO_BROWSER.BUILT,
                hash: stats.hash,
                warnings: stats.warnings || [],
                errors: stats.errors || []
            });
        };
        this.publish = (payload)=>{
            if (this.closed) return;
            this.eventStream.publish(payload);
        };
        this.close = ()=>{
            if (this.closed) return;
            // Can't remove compiler plugins, so we just set a flag and noop if closed
            // https://github.com/webpack/tapable/issues/32#issuecomment-350644466
            this.closed = true;
            this.eventStream.close();
        };
        this.eventStream = new EventStream();
        this.clientLatestStats = null;
        this.middlewareLatestStats = null;
        this.serverLatestStats = null;
        this.closed = false;
        this.versionInfo = versionInfo;
        compilers[0].hooks.invalid.tap("webpack-hot-middleware", this.onClientInvalid);
        compilers[0].hooks.done.tap("webpack-hot-middleware", this.onClientDone);
        compilers[1].hooks.invalid.tap("webpack-hot-middleware", this.onServerInvalid);
        compilers[1].hooks.done.tap("webpack-hot-middleware", this.onServerDone);
        compilers[2].hooks.done.tap("webpack-hot-middleware", this.onEdgeServerDone);
        compilers[2].hooks.invalid.tap("webpack-hot-middleware", this.onEdgeServerInvalid);
    }
}

//# sourceMappingURL=hot-middleware.js.map