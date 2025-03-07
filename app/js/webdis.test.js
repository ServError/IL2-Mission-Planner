import { assert } from 'chai';
import conf from '../../dist/conf.json' with { type: "json" };

if (!CustomEvent) {
  var CustomEvent = function(name, params){ return params;};
}

import webdis from './webdis.js';

describe('webdis', function() {

    it('must be defined', function() {
        assert.isDefined(webdis);
    });

    describe('webdis.subscribe', function() {

        it('must be defined', function() {
            assert.isDefined(webdis.subscribe);
        });
    });

    describe('webdis.publish', function() {

        it('must be defined', function() {
            assert.isDefined(webdis.publish);
        });
    });

    describe('webdis._buildSubscribeUrl', function() {

        it('must be defined', function() {
            assert.isDefined(webdis._buildSubscribeUrl);
        });

        it('must build subscribe url based on channel', function() {
            assert.equal(webdis._buildSubscribeUrl('test'),
                    conf.webdisUrl + '/SUBSCRIBE/test');
        });
    });

    describe('webdis._buildPublishUrl', function() {

        it('must be defined', function() {
            assert.isDefined(webdis._buildPublishUrl);
        });

        it('must build publish url based on channel and message', function() {
            assert.equal(webdis._buildPublishUrl('test', 'value'),
                    conf.webdisUrl + '/PUBLISH/test/value');
        });
    });

    describe('webdis._buildUnsubscribeUrl', function() {

        it('must be defined', function() {
            assert.isDefined(webdis._buildUnsubscribeUrl);
        });

        it('must build publish url based on channel and message', function() {
            assert.equal(webdis._buildUnsubscribeUrl('test'),
                    conf.webdisUrl + '/UNSUBSCRIBE/test');
        });
    });

});
