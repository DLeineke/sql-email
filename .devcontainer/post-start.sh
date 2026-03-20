#!/bin/bash
set -e

/var/post-start-base.sh # Base post-start script

# Ran as user anytime the container is started. Does NOT include command > Reload Window
# Place startup steps here...
