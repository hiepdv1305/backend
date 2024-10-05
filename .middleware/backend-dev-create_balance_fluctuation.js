'use strict';
    
const middleware_authenication = require('../middleware/authenication');
const apps_balance_fluctuation = require('../apps/balance_fluctuation');

module.exports.handler = async (event, context) => {
  let end = false;
  context.end = () => end = true;

  const wrappedHandler = handler => prev => {
    if (end) return prev;
    context.prev = prev;
    return handler(event, context);
  };

  return Promise.resolve()
    .then(wrappedHandler(middleware_authenication.isAuth.bind(middleware_authenication)))
    .then(wrappedHandler(apps_balance_fluctuation.create_balance_fluctuation.bind(apps_balance_fluctuation)));
};