#!/bin/bash
echo "Detected SSH key for git. Adding SSH config" >&1
echo "" >&1

# Ensure we have the ssh folder
if [ ! -d ~/.ssh ]; then
    mkdir -p ~/.ssh
    chmod 700 ~/.ssh
fi

# Load the private key into a file.
cp ./ssh/id_rsa ~/.ssh/deploy_key

# Change the permissions on the file to
# be read-write for this user.
chmod 600 ~/.ssh/deploy_key

# Setup the ssh config file.
# Switch out the hostname for different hosts.
echo -e "Host bitbucket.com\n"\
        " IdentityFile ~/.ssh/deploy_key\n"\
        " IdentitiesOnly yes\n"\
        " UserKnownHostsFile=/dev/null\n"\
        " StrictHostKeyChecking no"\
        > ~/.ssh/config