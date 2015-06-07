'use strict';

var koa           = require('koa'),
    router        = require('koa-router'),
    _             = require('lodash');

function addToArray(from, to) {
  if (_.isArray(from)) {
    _.forEach(from, function (item) {
      to.push(item);
    });
  } else {
    to.push(from);
  }
}

class Autowired {
  constructor() {
    this.loggerHandler = null;
    this.securityHandler = null;
    this.exceptionHandler = null;
    this.bodyParserHandler = null;
  }

  setLoggerHandler(logger) {
    this.loggerHandler = logger;
    return this;
  }

  setSecurityHandler(security) {
    this.securityHandler = security;
    return this;
  }

  setExceptionHandler(exception) {
    this.exceptionHandler = exception;
    return this;
  }

  setBodyParserHandler(bodyParser) {
    this.bodyParserHandler = bodyParser;
    return this;
  }

  logger(type, log) {
    if (this.loggerHandler) {
      this.loggerHandler[type](log);
    }
  }

  controller(controller, route, prefix) {
    var method  = controller.method || 'GET',
        args    = [],
        pre     = controller.pre_actions || [],
        action  = controller.action,
        post    = controller.post_actions || [];

    prefix = prefix || '';

    controller.path = prefix + controller.path;

    //action needs to be defined.
    if (!action) {
      throw new Error('action not found');
    }

    //add security if security is presented.
    if (controller.security) {
      if (!this.securityHandler) {
        throw new Error('securityHandler not found');
      }
      //security engine returns a middleware.
      addToArray(this.securityHandler(controller.security), args);
    }

    if (method !== 'GET') {
      //we need to add body parser if bodyParserHandler set.
      if (this.bodyParserHandler) {
        addToArray(this.bodyParserHandler(controller.body), args);
      }
    }

    //add pre actions
    _.forEach(pre, function (middleware) {
      args.push(middleware);
    });

    //add actual controller action
    args.push(action);

    //add post action
    _.forEach(post, function (middleware) {
      args.push(middleware);
    });

    //we are adding path at beginning of args
    args.unshift(controller.path);
    method = method.toLowerCase();
    route[method].apply(route, args);

    console.log(`registered ${controller.method} : ${controller.path}`);
    this.logger('info', `registered ${controller.method} : ${controller.path}`);
  }

  groupControllers(controller, route, prefix) {
    var groupPath   = controller.path || '',
        localRoute  = router(),
        groupPre    = controller.pre_actions || [],
        groupPost   = controller.post_actions || [];

    prefix = prefix || '';
    groupPath = prefix + groupPath;

    if (groupPath.security) {
      if (!this.securityHandler) {
        throw new Error('securityHandler not found');
      }
      //security engine returns a middleware.
      localRoute.use(this.securityHandler(controller.security));
    }

    _.forEach(groupPre, function (pre) {
      localRoute.use(pre);
    });

    _.forEach(controller.controllers, function (controller) {
      controller.path = groupPath + controller.path;
      this.controller(controller, localRoute);
    }.bind(this));

    _.forEach(groupPost, function (post) {
      localRoute.use(post);
    });

    route
      .use(localRoute.routes())
      .use(localRoute.allowedMethods());
  }

  process(entry) {
    var app = koa(),
        prefix = `/${entry.prefix}/${entry.version}`,
        route = router();

    if (this.exceptionHandler) {
      route.use(this.exceptionHandler());
    }

    _.forEach(entry.controllers, function (controller) {
      if (controller.group) {
        this.groupControllers(controller.group, route, prefix);
      } else {
        this.controller(controller, route, prefix);
      }
    }.bind(this));

    app
      .use(route.routes())
      .use(route.allowedMethods());

    return app;
  }
}

module.exports = Autowired;
