function wrapLayer(layer) {
  const handler = layer.handle;
  if (typeof handler !== "function" || handler.length > 3 || handler.__asyncWrapped) return;
  layer.handle = function asyncRouteHandler(req, res, next) {
    Promise.resolve(handler(req, res, next)).catch(next);
  };
  layer.handle.__asyncWrapped = true;
}

export function wrapAsyncRouter(router) {
  router.stack.forEach((layer) => {
    if (layer.route?.stack) layer.route.stack.forEach(wrapLayer);
    else wrapLayer(layer);
  });
  return router;
}
