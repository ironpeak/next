import { ResponseAbortedName, createAbortController } from "./web/spec-extension/adapters/next-request";
import { DetachedPromise } from "../lib/detached-promise";
import { getTracer } from "./lib/trace/tracer";
import { NextNodeServerSpan } from "./lib/trace/constants";
import { getClientComponentLoaderMetrics } from "./client-component-renderer-logger";
export function isAbortError(e) {
    return (e == null ? void 0 : e.name) === "AbortError" || (e == null ? void 0 : e.name) === ResponseAbortedName;
}
function createWriterFromResponse(res, waitUntilForEnd) {
    let started = false;
    // Create a promise that will resolve once the response has drained. See
    // https://nodejs.org/api/stream.html#stream_event_drain
    let drained = new DetachedPromise();
    function onDrain() {
        drained.resolve();
    }
    res.on("drain", onDrain);
    // If the finish event fires, it means we shouldn't block and wait for the
    // drain event.
    res.once("close", ()=>{
        res.off("drain", onDrain);
        drained.resolve();
    });
    // Create a promise that will resolve once the response has finished. See
    // https://nodejs.org/api/http.html#event-finish_1
    const finished = new DetachedPromise();
    res.once("finish", ()=>{
        finished.resolve();
    });
    // Create a writable stream that will write to the response.
    return new WritableStream({
        write: async (chunk)=>{
            // You'd think we'd want to use `start` instead of placing this in `write`
            // but this ensures that we don't actually flush the headers until we've
            // started writing chunks.
            if (!started) {
                started = true;
                if ("performance" in globalThis && process.env.NEXT_OTEL_PERFORMANCE_PREFIX) {
                    const metrics = getClientComponentLoaderMetrics();
                    if (metrics) {
                        performance.measure(`${process.env.NEXT_OTEL_PERFORMANCE_PREFIX}:next-client-component-loading`, {
                            start: metrics.clientComponentLoadStart,
                            end: metrics.clientComponentLoadStart + metrics.clientComponentLoadTimes
                        });
                    }
                }
                res.flushHeaders();
                getTracer().trace(NextNodeServerSpan.startResponse, {
                    spanName: "start response"
                }, ()=>undefined);
            }
            try {
                const ok = res.write(chunk);
                // Added by the `compression` middleware, this is a function that will
                // flush the partially-compressed response to the client.
                if ("flush" in res && typeof res.flush === "function") {
                    res.flush();
                }
                // If the write returns false, it means there's some backpressure, so
                // wait until it's streamed before continuing.
                if (!ok) {
                    await drained.promise;
                    // Reset the drained promise so that we can wait for the next drain event.
                    drained = new DetachedPromise();
                }
            } catch (err) {
                res.end();
                throw new Error("failed to write chunk to response", {
                    cause: err
                });
            }
        },
        abort: (err)=>{
            if (res.writableFinished) return;
            res.destroy(err);
        },
        close: async ()=>{
            // if a waitUntil promise was passed, wait for it to resolve before
            // ending the response.
            if (waitUntilForEnd) {
                await waitUntilForEnd;
            }
            if (res.writableFinished) return;
            res.end();
            return finished.promise;
        }
    });
}
export async function pipeToNodeResponse(readable, res, waitUntilForEnd) {
    try {
        // If the response has already errored, then just return now.
        const { errored, destroyed } = res;
        if (errored || destroyed) return;
        // Create a new AbortController so that we can abort the readable if the
        // client disconnects.
        const controller = createAbortController(res);
        const writer = createWriterFromResponse(res, waitUntilForEnd);
        await readable.pipeTo(writer, {
            signal: controller.signal
        });
    } catch (err) {
        // If this isn't related to an abort error, re-throw it.
        if (isAbortError(err)) return;
        throw new Error("failed to pipe response", {
            cause: err
        });
    }
}

//# sourceMappingURL=pipe-readable.js.map