define(
	(require, factory) => {
        const ko = require('knockout');
        const { Route } = require('providers/Route');

		function routes(appModel) {

            const search = new Route((query) => {
                appModel.activePage(this.title);
                require(['./vocabulary'], function (search) {
                    const view = 'vocabulary';

                    if (appModel.currentView() !== view) {
                        appModel.componentParams({
                            query: ko.observable(),
                        });
                    }

                    appModel.componentParams().query(query ? unescape(query) : null);

                    appModel.currentView(view);
                });
            });

			return {        
				'/search/:query:': search,
				'/search': search,
			};
		}

		return routes;
	}
);