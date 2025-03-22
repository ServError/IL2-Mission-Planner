import { assert } from 'chai';

import util from './util.js';
//import mock from 'xhr-mock';

//xhr-mock.setup()
describe('util', function() {

    it('must be defined', function() {
        assert.isDefined(util);
    });

    describe('util.formatTime', function() {

        it('must be defined', function() {
            assert.isDefined(util.formatTime);
        });

        var tests = [
            {
                given: 120,
                expected: '2:00'
            },
            {
                given: 119,
                expected: '1:59'
            },
            {
                given: 121,
                expected: '2:01'
            },
            {
                given: 0,
                expected: '0:00'
            }
        ];

        tests.forEach(function(test) {
            it('must return '+test.expected+' given '+test.given, function() {
                assert.strictEqual(util.formatTime(test.given), test.expected);
            });
        });
    });

    describe('util.isAvailableMapHash', function() {

        it('must be defined', function() {
            assert.isDefined(util.isAvailableMapHash);
        });

        var mockMaps = {
            stalingrad: {
                hash: '#stalingrad',
                selectIndex: 0
            },
            other: {
                hash: '#other',
                selectIndex: 1
            }
        };

        var tests = [
            {
                given: '#stalingrad',
                expected: true
            },
            {
                given: '#none',
                expected: false
            }
        ]

        tests.forEach(function(test) {
            it('must return '+test.expected+' given '+test.given, function() {
                assert.strictEqual(util.isAvailableMapHash(test.given, mockMaps), test.expected);
            });
        });
    });

    describe('util.getSelectedMapConfig', function() {

        it('must be defined', function() {
            assert.isDefined(util.getSelectedMapConfig);
        });

        var mockMaps = {
            stalingrad: {
                hash: '#stalingrad',
                selectIndex: 0
            },
            other: {
                hash: '#other',
                selectIndex: 1
            }
        };

        var tests = [
            {
                given: '#stalingrad',
                expected: 'stalingrad'
            },
            {
                given: '#other',
                expected: 'other'
            },
            {
                given: '#none',
                expected: 'stalingrad'
            }
        ]

        tests.forEach(function(test) {
            it('must return '+test.expected+' given '+test.given, function() {
                assert.strictEqual(util.getSelectedMapConfig(test.given, mockMaps), mockMaps[test.expected]);
            });
        });
    });

    describe('util.defaultPopulateArray', function() {

        it('must be defined', function() {
            assert.isDefined(util.defaultPopulateArray);
        });

        var tests = [
            {
                given: {
                    val: 300,
                    count: 5
                },
                expectedLength: 5
            },
            {
                given: {
                    val: 300,
                    count: 0
                },
                expectedLength: 0
            }
        ]

        tests.forEach(function(test) {
            it('must return array of length '+test.expectedLength+' given '+test.given.val+' and '+test.given.count, function() {
                assert.lengthOf(util.defaultPopulateArray(test.given.val, test.given.count), test.expectedLength);
            });
        });
    });

    describe('util.formatFlightLegMarker', function() {

        it('must be defined', function() {
            assert.isDefined(util.formatFlightLegMarker);
        });

        var expected = '<div style="background: rgba(100, 100, 100, .75); transform: rotate(26deg);">400kph | 116&deg;/296&deg; <br/> 300.0km | ETE 60:00</div>';
        var given = {
            distance: 300,
            heading: 116,
            speed: 400,
            time: '60:00'
        }
 
        it('must return '+expected+' given '+given.distance+', '+given.heading+', '+given.speed+' and '+given.time, function() {
            assert.strictEqual(util.formatFlightLegMarker(given.distance, given.heading, given.speed, given.time, 'metric'), expected);
        });
    });

    describe('util.buildGetXhr', function() {

        it('must be defined', function() {
            assert.isDefined(util.buildGetXhr);
        });
    });

    describe('util.buildSyncGetXhr', function() {

        it('must be defined', function() {
            assert.isDefined(util.buildSyncGetXhr);
        });
    });

    //xhr-mock.teardown();

});
