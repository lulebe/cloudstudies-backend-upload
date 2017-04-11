# Usage

`npm install` dependencies. Initialize MySQL DB according to model in `/db/model.js`. Start with env variables below.


# Required env variables
- `PORT` Http server PORT
- `DBHOST` mysql db host
- `DBPORT` mysql db port
- `DBNAME` mysql db name
- `DBUSR` mysql db user
- `DBPW` mysql db pw
- `DBSSLKEY` mysql db ssl key
- `DBSSLCERT`mysql db ssl certificate
- `DBSSLCA` mysql db ssl ca certificate
- `INTERNAL_AUTH_KEY` authentication key for communating with other servers
- `UPLOAD_PATH` path to folder for uploaded files
- `API_URL` path to main app api

# HTTP Routes

- upload File `POST /folder/:folderid`
- get File `GET /file/:fileid`
- delete File `DELETE /file/:fileid`
