'use strict';

const memberList = [];

exports.onHandleDocs = function (ev) {
    for (let tag of ev.data.docs) {
        if (tag.kind === 'get' || tag.kind === 'set') {
            let key = tag.memberof + '.' + tag.name;

            // ignore if get or set was already processed
            if (memberList.indexOf(key) >= 0) {
                ev.data.docs.splice(ev.data.docs.indexOf(tag), 1);
            }

            else {
                tag.kind = 'member';
                memberList.push(key);
            }
        }
    }
};
