#!/usr/bin/env bash
if [ $CREDENTIALS ]
then
    git config --global credential.helper 'store'
    echo $CREDENTIALS >> ~/.git-credentials
    echo 'Configured git credentials'
fi
