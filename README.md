# Frontend env setup
Either use the arg `BACKEND_URL` in the docker container or set a `.env` in the `src/` directory with
contents like in `src/.example-env`. It's important to add a `VITE_` to the ENV vars, if not set
via docker