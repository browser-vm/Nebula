importScripts("/uv/uv.bundle.js");
importScripts("/uv/uv.config.js");
importScripts('/scram/scramjet.wasm.js');
importScripts('/scram/scramjet.shared.js');
importScripts('/scram/scramjet.worker.js');
importScripts("/workerware/workerware.js");
importScripts("/uv/uv.sw.js");

const __uv$config = self.__uv$config || {};
const UVServiceWorker = self.UVServiceWorker || class {};
const WorkerWare = self.WorkerWare || class {};
const ScramjetServiceWorker = self.ScramjetServiceWorker || class {};

const uv = new UVServiceWorker();
const ww = new WorkerWare({ debug: false });
const sj = new ScramjetServiceWorker();

(async function () {
    await sj.loadConfig();
})();

// Handle Firefox specific behavior
if (navigator.userAgent.includes("Firefox")) {
    Object.defineProperty(globalThis, "crossOriginIsolated", {
        value: true,
        writable: true
    });
}

// Handle plugins
self.addEventListener("message", function (event) {
    console.log(event.data);
    uv.config.inject = [];
    event.data.forEach((data) => {
        if (data.remove) {
            if (data.type === "page") {
                const idx = uv.config.inject.indexOf(data.host);
                uv.config.inject.splice(idx, 1);
            } else if (data.type === "serviceWorker") {
                ww.deleteByName(data.name);
            }
        } else {
            if (data.type === "page") {
                uv.config.inject.push({
                    host: data.host,
                    html: data.html,
                    injectTo: data.injectTo
                });
            } else if (data.type === "serviceWorker") {
                const wwFunction = eval(data.function);
                ww.use({
                    function: wwFunction ? wwFunction : new Function(data.function),
                    name: data.name,
                    events: data.events
                });
            } else {
                console.error("NO type exists for that. Only serviceWorker & page exist.");
                return;
            }
        }
    });
});

self.addEventListener("fetch", function (event) {
    event.respondWith(
        (async () => {
            const wwRes = await ww.run(event)();
            if (wwRes.includes(null)) {
                return;
            }
            if (event.request.url.startsWith(location.origin + __uv$config.prefix)) {
                return await uv.fetch(event);
            } 
            else if (sj.route(event)) {
                return await sj.fetch(event);
            }
            else {
                return await fetch(event.request);
            }
        })()
    );
});