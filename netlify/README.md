# Netlify deployment

This folder contains a copy of the website in `site/` and the hiscores API
function in `functions/`. The repository-root `netlify.toml` configures both.

## Deploy from GitHub

1. Push this repository to GitHub.
2. In Netlify, choose **Add new site** → **Import an existing project** and
   select the repository.
3. Leave the base directory and build command blank. The repository's
   `netlify.toml` sets the publish directory and functions directory.
4. Deploy the site.

The site uses `/api/hiscores`, which Netlify routes to the function. No
environment variables or extra packages are required.
