'use strict';

const lodash = require('lodash');

const {TestContext} = require('@tapps-games/test');
const {MagicMock} = require('@tapps-games/magic-mock');

const gameConfig = require('../fixtures/config/game');
const cityConfig = require('../fixtures/config/cities');
const itemsConfig = require('../fixtures/config/items');

const stateFixture = require('../fixtures/state/state');

const { BidInterval } = require('../../src/helpers/bid-interval');

describe('AuctionController Unit tests', function() {
    const moduleTestContext = new TestContext({
        moduleName: 'auctionController',
        fromPath: 'rooms/bidpvp/controllers/auction-controller',
        dependencies: ['Config'],
    });

    let auctionController, Config, room, state, auction;

    beforeEach(async function () {
        auctionController = moduleTestContext.auctionController;
        Config = moduleTestContext.Config;
        room = new MagicMock('room');
        state = lodash.cloneDeep(stateFixture);

        Config.game = gameConfig;
        Config.cities = cityConfig;
        Config.items = itemsConfig;

        auction = new auctionController.AuctionController(room, 'City01');
    });

    describe('AuctionController bid Tests', function() {

        it('should bid a lot', async function() {
            auction.state = state;

            auction.finishBidInterval = new MagicMock('finishBid');

            auction.bid('xfSB3PMvG');
            expect(room.clock.setTimeout).to.have.invocationCount(1);

            const timeoutCallback = room.clock.setTimeout.$.invocations[0][0];
            timeoutCallback();

            expect(auction.bidInterval.drawPlayers[0]).to.equal('xfSB3PMvG');
            expect(auction.finishBidInterval).to.have.invocationCount(1);
        });

        it('should not bid , player has less money', async function() {
            state.players['xfSB3PMvG'].money = 0;
            auction.state = state;

            auction.finishBidInterval = new MagicMock('finishBid');

            auction.bid('xfSB3PMvG');
            expect(room.clock.setTimeout).to.have.invocationCount(0);

            expect(auction.bidInterval).to.not.exist;
            expect(auction.finishBidInterval).to.have.invocationCount(0);
        });

        it('should not bid , player has the highest bid', async function() {
            state.lots[0].bidOwner = 'xfSB3PMvG';
            auction.state = state;

            auction.finishBidInterval = new MagicMock('finishBid');

            auction.bid('xfSB3PMvG');
            expect(room.clock.setTimeout).to.have.invocationCount(0);

            expect(auction.bidInterval).to.not.exist;
            expect(auction.finishBidInterval).to.have.invocationCount(0);
        });

        it('should bid a lot, 2 players draw', async function() {
            auction.state = state;

            auction.finishBidInterval = new MagicMock('finishBid');

            auction.bid('xfSB3PMvG');
            auction.bid('abcdHfSta');
            expect(room.clock.setTimeout).to.have.invocationCount(1);

            const timeoutCallback = room.clock.setTimeout.$.invocations[0][0];
            timeoutCallback();

            expect(auction.bidInterval.drawPlayers[0]).to.equal('xfSB3PMvG');
            expect(auction.bidInterval.drawPlayers[1]).to.equal('abcdHfSta');
            expect(auction.finishBidInterval).to.have.invocationCount(1);
        });

        describe('AuctionController finishBidInterval Tests', function() {

            it('should put current bidder as current winner', async function() {
                auction.bidInterval = new BidInterval();
                auction.bidInterval.addBid('xfSB3PMvG');

                auction.state = state;

                auction._runDole = new MagicMock('runDole');

                auction.finishBidInterval();
                expect(room.clock.setTimeout).to.have.invocationCount(1);

                const timeoutCallback = room.clock.setTimeout.$.invocations[0][0];
                timeoutCallback();

                expect(auction.state.lots[0].bidOwner).to.equal('xfSB3PMvG');
                expect(auction.state.lots[0].bidValue).to.equal(150);
                expect(auction.state.players['xfSB3PMvG'].lastBid).to.equal(150);
                expect(auction._runDole).to.have.invocationCount(1);
            });
        });

    });
});