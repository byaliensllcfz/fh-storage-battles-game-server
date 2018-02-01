#!/usr/bin/env bash
if [ $GAE_INSTANCE ]
then
    git config --global credential.helper 'store'
    echo $CREDENTIALS >> ~/.git-credentials
fi
