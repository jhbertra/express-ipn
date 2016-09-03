var chai = require('chai');
var mockery = require('mockery');
var sinon = require('sinon');
var expect = chai.expect;

describe('Express IPN', function () {

    var ipn;
    var response;
    var requestStub;
    var request;

    before(function () {
        mockery.enable({useCleanCache: true});
        mockery.warnOnUnregistered(false);
        mockery.warnOnReplace(false);

        var https = require('https');
        var querystring = require('querystring');

        mockery.registerMock('https', https);
        mockery.registerMock('querystring', querystring);

        request = {
            write: sinon.stub(),
            on: sinon.stub(),
            end: sinon.stub()
        };

        requestStub = sinon.stub(https, 'request', function (options, callback) {
            return request;
        });

        ipn = require('../index');
    });

    beforeEach(function () {

    });

    afterEach(function () {

    });

    after(function () {
        mockery.deregisterAll();
        mockery.disable();
        requestStub.restore();
    });

    it('Should export a member called validator', function () {
        expect(ipn.validator).to.exist;
    });

    it('Should export a function validator', function () {
        expect(typeof ipn.validator).to.equal('function');
    });

    describe('validator', function () {

        var sendStatusStub;
        var callbackStub;

        var req;
        var res;

        var response;

        before(function () {
            sendStatusStub = sinon.stub();
            callbackStub = sinon.stub();

            req = {
                body: {}
            };
            res = {
                sendStatus: sendStatusStub
            };

            response = {
                on: sinon.stub()
            }
        });

        afterEach(function () {
            sendStatusStub.reset();
            callbackStub.reset();
            requestStub.reset();
            request.write.reset();
            request.on.reset();
            request.end.reset();
            response.on.reset();
            req.body = {};
        });

        after(function () {
            mockery.deregisterMock('https');
            mockery.deregisterMock('querystring');
        });

        function run(productionMode) {
            ipn.validator(callbackStub, productionMode === undefined ? true : productionMode)(req, res);
        }

        it('Should be a closure', function () {
            expect(typeof ipn.validator(function () {
            })).to.equal('function');
        });

        it('Not return a middleware if the callback is not defined', function () {
            expect(ipn.validator()).to.not.exist;
        });

        it('Not return a middleware if the callback is not a function', function () {
            expect(ipn.validator("asdf")).to.not.exist;
        });

        it('Should send a 200 status code', function () {
            run();
            expect(sendStatusStub.getCall(0).args[0]).to.equal(200);
        });

        it('Should call the callback with an error if the ipn is a test one and production mode is on.', function () {
            req.body = {
                test_ipn: '1'
            };
            run(true);
            expect(callbackStub.getCall(0).args[0].message).to.equal("Production mode is on, cannot handle sandbox IPNs.");
        });

        it('Should call the callback with an error if the ipn is a live one and production mode is off.', function () {
            run(false);
            expect(callbackStub.getCall(0).args[0].message).to.equal("Production mode is off, cannot handle live IPNs.");
        });

        it('Should call https.request', function () {
            run();
            expect(requestStub.getCall(0)).to.exist;
        });

        it('Should make the request to www.paypal.com if the ipn is a live one', function () {
            run();
            expect(requestStub.getCall(0).args[0].host).to.equal('www.paypal.com');
        });

        it('Should make the request to www.sandbox.paypal.com if the ipn is a test one', function () {
            req.body = {
                test_ipn: '1'
            };
            run(false);
            expect(requestStub.getCall(0).args[0].host).to.equal('www.sandbox.paypal.com');
        });

        it('Should use the POST method', function () {
            run();
            expect(requestStub.getCall(0).args[0].method).to.equal('POST');
        });

        it('Should make the request to the /cgi-bin/webscr path', function () {
            run();
            expect(requestStub.getCall(0).args[0].path).to.equal('/cgi-bin/webscr');
        });

        it('Should set the content length header to the correct length', function () {
            run();
            expect(requestStub.getCall(0).args[0].headers['Content-Length']).to.equal('&cmd=_notify-validate'.length);
        });

        it('Should set the content type header to application/x-www-form-urlencoded', function () {
            run();
            expect(requestStub.getCall(0).args[0].headers['Content-Type']).to.equal('application/x-www-form-urlencoded');
        });

        it('Should add &cmd=_notify-validate to the end of the body when sending the verification', function () {
            req.body = { foo: 'bar'};
            run();
            expect(request.write.getCall(0).args[0]).to.equal('foo=bar&cmd=_notify-validate');
        });

        it('Should pass the callback to the https request error event', function () {
            run();
            expect(request.on.getCall(0).args[0]).to.equal('error');
            expect(request.on.getCall(0).args[1]).to.equal(callbackStub);
        });

        function respond() {
            requestStub.getCall(0).args[1](response);
        }

        it('Should register a callback for the response data received event', function () {
            run();
            respond();
            expect(response.on.getCall(0).args[0]).to.equal('data');
        });

        it('Should register a callback for the response end event', function () {
            run();
            respond();
            expect(response.on.getCall(1).args[0]).to.equal('end');
        });

        it('Should not pass an error to the callback if the response is VERIFIED', function () {
            run();
            respond();
            response.on.getCall(0).args[1]("VERIFIED");
            response.on.getCall(1).args[1]();
            expect(callbackStub.getCall(0).args[0]).to.be.null;
        });

        it('Should pass the parsed ipn content to the callback if the response is VERIFIED', function () {
            req.body = { foo: 'bar' };
            run();
            respond();
            response.on.getCall(0).args[1]("VERIFIED");
            response.on.getCall(1).args[1]();
            expect(JSON.stringify(callbackStub.getCall(0).args[1])).to.equal('{"foo":"bar"}');
        });

        it('Should pass an error to the callback if the response is not VERIFIED', function () {
            run();
            respond();
            response.on.getCall(0).args[1]("INVALID");
            response.on.getCall(1).args[1]();
            expect(callbackStub.getCall(0).args[0]).to.not.be.null;
        });

        it('Should pass the parsed ipn content to the callback if the response is not VERIFIED', function () {
            req.body = { foo: 'bar' };
            run();
            respond();
            response.on.getCall(0).args[1]("INVALID");
            response.on.getCall(1).args[1]();
            expect(JSON.stringify(callbackStub.getCall(0).args[1])).to.equal('{"foo":"bar"}');
        });

    });

});