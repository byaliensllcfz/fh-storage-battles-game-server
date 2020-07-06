'use strict';

const lodash = require('lodash');

const { Config } = require('../../src/helpers/config-helper');

const gameConfig = require('../fixtures/config/game');
const cityConfig = require('../fixtures/config/cities');
const itemsConfig = require('../fixtures/config/items');
const boxesConfig = require('../fixtures/config/boxes');

describe('ConfigHelper Unit tests', function() {

    const config = {
        game: gameConfig,
        items: lodash.values(itemsConfig),
        boxes: lodash.values(boxesConfig),
        cities: lodash.values(cityConfig),
    };

    describe('_separateCityJunkItems tests', function() {

        it('should set cities junkItems on Config.set', async function() {
            Config.set(config);

            expect(Config.cities['City01'].junkItems.length).to.equal(0);
            expect(Config.cities['City02'].junkItems.length).to.equal(2);

            expect(Config.cities['City02'].junkItems).to.deep.equal(['junk01','junk02']);
        });

        it('should not show JUNK on common items list', async function() {
            Config.set(config);

            expect(Config.cities['City01'].itemsRarity['Common'].items.length).to.equal(2);
            expect(Config.cities['City02'].itemsRarity['Common'].items.length).to.equal(2);

            expect(Config.cities['City01'].itemsRarity['Common'].items).to.deep.equal(['common01','common02']);
            expect(Config.cities['City02'].itemsRarity['Common'].items).to.deep.equal(['common01','common02']);
        });
    });
});
