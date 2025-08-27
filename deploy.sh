#!/bin/bash

# Nom du repo GitHub
REPO_NAME="vhp-main-fixed"
USER_NAME="TON_USER_GITHUB"
TOKEN="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"

# Crée le repo sur GitHub via API
curl -u $USER_NAME:$TOKEN https://api.github.com/user/repos \
  -d "{\"name\":\"$REPO_NAME\", \"private\":false}"

# Initialiser Git
git init
git add .
git commit -m "Initial commit: VHP project corrected"
git branch -M main

# Ajouter remote avec token
git remote add origin https://$USER_NAME:$TOKEN@github.com/$USER_NAME/$REPO_NAME.git

# Pousser sur GitHub
git push -u origin main

echo "✅ Dépôt poussé avec succès !"

echo "⚡ Active GitHub Pages manuellement :"
echo "1. Va sur https://github.com/$USER_NAME/$REPO_NAME/settings/pages"
echo "2. Sélectionne 'main' + '/' (root)"
echo "3. Clique 'Save'"
echo "Ton site sera bientôt disponible sur : https://$USER_NAME.github.io/$REPO_NAME/"
