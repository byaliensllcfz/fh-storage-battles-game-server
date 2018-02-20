#!/usr/bin/env bash
if [ $CREDENTIALS ]
then
    rm ~/.git-credentials
    echo 'Removing git credentials'
fi
