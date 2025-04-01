export default [
    {
        "rootDatabaseUrl": "postgres://${ROOT_POSTGRES_USER}:${ROOT_POSTGRES_PASSWORD}@${HOST}:${PORT}/${ROOT_POSTGRES_DB}?schema=public",
        "appDatabaseUrl": "postgres://${APP1_POSTGRES_USER}:${APP1_POSTGRES_PASSWORD}@${PORT}:${PORT}/${APP1_POSTGRES_DB}?schema=public"
    },
    {
        "rootDatabaseUrl": "postgres://${ROOT_POSTGRES_USER}:${ROOT_POSTGRES_PASSWORD}@${HOST}:${PORT}/${ROOT_POSTGRES_DB}?schema=public",
        "appDatabaseUrl": "postgres://${APP2_POSTGRES_USER}:${APP2_POSTGRES_PASSWORD}@${PORT}:${PORT}/${APP2_POSTGRES_DB}?schema=public"
    }
]