# express-ipn
Create a PayPal IPN listener in minutes with this easy-to-use Express middleware.

## Installation

```
$ npm install express-ipn
```

## Usage

Mount the middleware on a POST handler on the endpoint where you want you IPN listener to live:

```js
var app = require('express')();
var ipn = require('express-ipn');
var bodyParser = require('body-parser');

app.use(bodyParser.urlencoded({extended: false})); // IPN data is sent in the body as x-www-form-urlencoded data
app.post('/', ipn.validator(validationHandler));

function validationHandler(err, ipnContent) {
    if (err) {
        console.error("IPN invalid"); // The IPN was invalid
    } else {
        console.log(ipnContent); // The IPN was valid.
        ... // Process the IPN data
    }
}

...

```

when you are ready to go put your server into production, make the following change:
```js
...
app.post('/', ipn.validator(validationHandler, true));
...
```
## API

```js
var ipn = require('express-ipn');
ipn.validator(callback, [productionMode]);
```

`callback` will be called when the IPN verification protocol is complete. 
It will be passed two parameters: `err` and `ipnContent`.  `err` will be an `Error` object if verification fails.
Verification will fail under two circumstances:
 
 1. PayPal returned an `INVALID` message in response to the verification request, meaning the ipn is not valid
 2. A test IPN (such as from a sandbox account or the IPN simulator) was received when `productionMode` was enabled.
 This is to prevent a live server from handling fake data.  Conversely, if `productionMode` is disabled, a 
 live IPN will be treated as invalid, as non-development servers should not be handling live data.
 
 If verification succeeds, `err` will be null.  The content of the originally received IPN will be parsed as a 
 JavaScript object and passed in the `ipnContent` parameter.

`productionMode` is an optional which should be set to `true` when the listener is ready to go into production, and handle
live payment data.  It defaults to `false`.  Note the in order to handle test IPNs, such as those sent from sandbox 
accounts, or from the IPN simulator, productionMode must be `false`.  Conversely, to handle live IPNs, `productionMode`
must be set to `true`.
