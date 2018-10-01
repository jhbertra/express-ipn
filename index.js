var https = require('https');
var querystring = require('querystring');

var LIVE_HOST = 'www.paypal.com';
var SANDBOX_HOST = 'www.sandbox.paypal.com';

module.exports = {
    validator: function validator(callback, productionMode) {
        productionMode = Boolean(productionMode);
        if (typeof callback != 'function') {
            console.error('Cannot use provided callback - it was not a function.');
            console.error('Callback received: ' + callback);
            return;
        }
        return function validateIpn(req, res) {
            acknowledgeReceipt(res);
            sendVerificationRequest(req, callback, productionMode);
        };
    }
};

function acknowledgeReceipt(res) {
    res.sendStatus(200);
}

function sendVerificationRequest(req, callback, productionMode) {
    var ipnContent = req.body;

    if (productionMode === Boolean(ipnContent.test_ipn)) {
        var modeState = productionMode ? "on" : "off";
        var ipnEnv = productionMode ? "sandbox" : "live";
        var error = new Error("Production mode is "  + modeState + ", cannot handle " + ipnEnv + " IPNs.", ipnContent);
        error.req = req;
        callback(error);
    } else {
        var body = querystring.stringify(ipnContent) + '&cmd=_notify-validate';
        var requestParams = buildRequestParams(productionMode, body);
        var request = https.request(requestParams, handleResponse);
        request.write(body);
        request.on('error', function(err) {
          err.req = req;
          callback(err);
        });
        request.end();
    }

    function handleResponse(response) {
        var responseData = [];

        response.on('data', function dataReceived(data) {
            responseData.push(data);
        });

        response.on('end', function reponseDone() {
            var message = responseData.join('');

            if (message === 'VERIFIED') {
                callback(null, ipnContent, req);
            } else {
                var error = new Error("IPN verification failed, message: " + message);
                error.req = req;
                callback(error, ipnContent);
            }
        });

    }
}

function buildRequestParams(productionMode, body) {
    return {
        host: productionMode ? LIVE_HOST : SANDBOX_HOST,
        method: 'POST',
        path: '/cgi-bin/webscr',
        headers: {
            'Content-Length': body.length,
            'Content-Type': 'application/x-www-form-urlencoded'
        }
    };
}
