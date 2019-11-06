'use strict';

const { Logger } = require('@tapps-games/logging');
const logger = new Logger();

const { Room } = require('colyseus');
const { AuctionState } = require('./schemas/auction-state');
const { PlayerState } = require('./schemas/player-state');
const { AuctionController } = require('./controllers/auction-controller');
const { handleAuctionCommand } = require('./handlers/auction-handler');

const authDao = require('../../daos/auth-dao');
const configHelper = require('../../helpers/config-helper');
const { commands } = require('../../types');

class BidPvpRoom extends Room {
    onCreate(options) {
        logger.info(`Room Init ${JSON.stringify(options)} - ${this.roomId}`, { room: this.roomId });

        this.setState(new AuctionState());
        this.setPatchRate(1000 / 20);

        const cityId = 'first'; //TODO get city on options from room creation at matchmaking
        this.auctionController = new AuctionController(this, cityId);

        /** @type {Object} */
        const configs = configHelper.get();
        this.maxClients = configs.game.maxPlayers;
    }

    async onAuth(_client, options) {
        if (options.clientWeb) {
            return true;
        }

        if (options.userToken) {
            return await authDao.validateToken(options.userToken);
        }
    }

    async onJoin(client, options) {
        logger.info(`Client: ${client.id} joined. ${JSON.stringify(options)}`, { room: this.roomId });

        if (options.userToken) {
            const data = await authDao.validateToken(options.userToken);
            options.userId = data['game-user-id-data'].uid;
        }

        this.state.players[client.id] = new PlayerState({
            id: client.id,
            firebaseId: options.userId,
            character: options.character,
        });


        if (this.locked) {
            await this.lock(); // Prevent new players from joining if any players leave.

            await handleAuctionCommand(this, 'SERVER', { command: commands.AUCTION_START });
        }
    }

    onMessage(client, message) {
        logger.info(`Client: ${client.id} sent message ${JSON.stringify(message)}`, { room: this.roomId });

        if (this.locked) {
            handleAuctionCommand(this, client.id, message).catch(error => {
                logger.error(`Error handling message: ${message} from player: ${client.id}.`, error);
            });
        }
    }

    async onLeave(client, consented) {
        logger.info(`Client: ${client.id} left. Consented: ${consented}`, { room: this.roomId });
        this.state.players[client.id].connected = false;

        try {
            if (consented) {
                throw new Error('consented leave');
            }

            await this.allowReconnection(client, this.configs.game.allowReconnectionTimeSec);

            // The client has reconnected
            this.state.players[client.id].connected = true;
        }
        catch (e) {
            // consented leave OR allowReconnectiontimer expired.
        }
    }

    onDispose() {
        logger.info('Room disposed', { room: this.roomId });
    }
}

module.exports = BidPvpRoom;
