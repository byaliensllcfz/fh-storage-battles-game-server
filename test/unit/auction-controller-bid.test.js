'use strict';

const lodash = require('lodash');

const {TestContext} = require('@tapps-games/test');
const {MagicMock} = require('@tapps-games/magic-mock');

const gameConfig = require('../fixtures/config/game');
const cityConfig = require('../fixtures/config/cities');
const itemsConfig = require('../fixtures/config/items');

const stateFixture = require('../fixtures/state/state');

const { BidInterval } = require('../../src/helpers/bid-interval');
const { bidStatus } = require('../../src/types');

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
            const playerId = 'xfSB3PMvG';
            const client = { id: playerId };
            room.clients = [{ id: 'abcdefghi' }, client ];

            auction.state = state;

            auction.finishBidInterval = new MagicMock('finishBid');

            auction.bid(playerId);
            expect(room.clock.setTimeout).to.have.invocationCount(1);

            const timeoutCallback = room.clock.setTimeout.$.invocations[0][0];
            timeoutCallback();

            expect(auction.bidInterval.drawPlayers[0]).to.equal(playerId);
            expect(auction.finishBidInterval).to.have.invocationCount(1);
            expect(room.send).to.have.invocationCount(1);
            expect(room.send).to.be.invokedWith(client, JSON.stringify({ bidStatus: bidStatus.ACCEPTED }));
        });

        it('should not bid , player has less money', async function() {
            const playerId = 'xfSB3PMvG';
            const client = { id: playerId };
            room.clients = [{ id: 'abcdefghi' }, client ];

            state.players[playerId].money = 0;
            auction.state = state;

            auction.finishBidInterval = new MagicMock('finishBid');

            auction.bid(playerId);
            expect(room.clock.setTimeout).to.have.invocationCount(0);

            expect(auction.bidInterval).to.not.exist;
            expect(auction.finishBidInterval).to.have.invocationCount(0);
            expect(room.send).to.have.invocationCount(1);
            expect(room.send).to.be.invokedWith(client,
                JSON.stringify({ bidStatus: bidStatus.REJECTED_INSUFFICIENT_MONEY }));
        });

        it('should not bid , player has the highest bid', async function() {
            const playerId = 'xfSB3PMvG';
            const client = { id: playerId };
            room.clients = [{ id: 'abcdefghi' }, client ];

            state.lots[0].bidOwner = playerId;
            auction.state = state;

            auction.finishBidInterval = new MagicMock('finishBid');

            auction.bid(playerId);
            expect(room.clock.setTimeout).to.have.invocationCount(0);

            expect(auction.bidInterval).to.not.exist;
            expect(auction.finishBidInterval).to.have.invocationCount(0);
            expect(room.send).to.have.invocationCount(1);
            expect(room.send).to.be.invokedWith(client,
                JSON.stringify({ bidStatus: bidStatus.REJECTED_ALREADY_OWNER }));
        });

        it('should bid a lot, 2 players draw', async function() {
            const firstPlayerId = 'xfSB3PMvG';
            const secondPlayerId = 'abcdHfSta';
            const firstClient = { id: firstPlayerId };
            const secondClient = { id: secondPlayerId };
            room.clients = [secondClient, firstClient];

            auction.state = state;

            auction.finishBidInterval = new MagicMock('finishBid');

            auction.bid(firstPlayerId);
            auction.bid(secondPlayerId);
            expect(room.clock.setTimeout).to.have.invocationCount(1);

            const timeoutCallback = room.clock.setTimeout.$.invocations[0][0];
            timeoutCallback();

            expect(auction.bidInterval.drawPlayers[0]).to.equal(firstPlayerId);
            expect(auction.bidInterval.drawPlayers[1]).to.equal(secondPlayerId);
            expect(auction.finishBidInterval).to.have.invocationCount(1);
            expect(room.send).to.have.invocationCount(2);
            expect(room.send).to.be.invokedWith(firstClient,
                JSON.stringify({ bidStatus: bidStatus.ACCEPTED }));
            expect(room.send).to.be.invokedWith(secondClient,
                JSON.stringify({ bidStatus: bidStatus.ACCEPTED }));
        });

        it('should not bid , player has stop effect', async function() {
            const playerId = 'xptoeffect';
            const secondPlayerId = 'abcdHfSta';
            const client = { id: playerId };
            //client.effects['stop'] = {id: 'stop', expiration: Date.now()};
            room.clients = [{ id: 'abcdefghi' }, client ];

            state.lots[0].bidOwner = secondPlayerId;
            state.players['xptoeffect'].effects['stop'].expiration = Date.now() + 6000000;
            auction.state = state;

            auction.finishBidInterval = new MagicMock('finishBid');

            auction.bid(playerId);
            expect(room.clock.setTimeout).to.have.invocationCount(0);

            expect(auction.bidInterval).to.not.exist;
            expect(auction.finishBidInterval).to.have.invocationCount(0);
            expect(room.send).to.have.invocationCount(1);
            expect(room.send).to.be.invokedWith(client,
                JSON.stringify({ bidStatus: bidStatus.REJECTED_STOP_POWER }));
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
