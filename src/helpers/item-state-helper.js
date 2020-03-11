'use strict';

function getItemPrice(config, price, state) {
    let newPrice = price;

    if (state === 'OLD') {
        newPrice = parseInt((config.game.oldItemStatePriceModifier * price).toFixed(0));
    }
    else if (state === 'NEW') {
        newPrice = parseInt((config.game.newItemStatePriceModifier * price).toFixed(0));
    }
    return newPrice;
}

module.exports = {
    getItemPrice,
};
