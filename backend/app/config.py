import os
from urllib.parse import urlparse
from dotenv import load_dotenv

load_dotenv()

class Settings:
    PROJECT_NAME: str = "Modern Python ERP"
    VERSION: str = "2.0.0"
    
    DB_HOST: str = os.getenv("DB_HOST", "localhost")
    DB_PORT: str = os.getenv("DB_PORT", "3306")
    DB_USER: str = os.getenv("DB_USER", "root")
    DB_PASSWORD: str = os.getenv("DB_PASSWORD", "root")
    DB_NAME: str = os.getenv("DB_NAME", "erp_db")
    
    @property
    def DATABASE_URL(self) -> str:
        env_url = (
            os.getenv("DATABASE_URL")
            or os.getenv("MYSQL_URL")
            or os.getenv("JAWSDB_URL")
            or os.getenv("CLEARDB_DATABASE_URL")
        )
        if env_url:
            if env_url.startswith("mysql://"):
                env_url = env_url.replace("mysql://", "mysql+pymysql://", 1)
            elif env_url.startswith("postgres://"):
                env_url = env_url.replace("postgres://", "postgresql://", 1)
            return env_url
        return f"mysql+pymysql://{self.DB_USER}:{self.DB_PASSWORD}@{self.DB_HOST}:{self.DB_PORT}/{self.DB_NAME}"

    @property
    def parsed_db_config(self) -> dict:
        """Extract database credentials dictionary from DATABASE_URL or individual env vars."""
        env_url = (
            os.getenv("DATABASE_URL")
            or os.getenv("MYSQL_URL")
            or os.getenv("JAWSDB_URL")
            or os.getenv("CLEARDB_DATABASE_URL")
        )
        if env_url:
            url = env_url
            for prefix in ["mysql+pymysql://", "mysql://", "postgresql://", "postgres://"]:
                if url.startswith(prefix):
                    url = url.replace(prefix, "http://", 1)
                    break
            parsed = urlparse(url)
            return {
                "host": parsed.hostname or self.DB_HOST,
                "port": parsed.port or int(self.DB_PORT),
                "user": parsed.username or self.DB_USER,
                "password": parsed.password or self.DB_PASSWORD,
                "database": parsed.path.lstrip('/') if parsed.path else self.DB_NAME
            }
        return {
            "host": self.DB_HOST,
            "port": int(self.DB_PORT),
            "user": self.DB_USER,
            "password": self.DB_PASSWORD,
            "database": self.DB_NAME
        }

    SECRET_KEY: str = os.getenv("SECRET_KEY", "secret-key")
    ALGORITHM: str = os.getenv("ALGORITHM", "HS256")
    ACCESS_TOKEN_EXPIRE_MINUTES: int = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "1440"))
    OPENROUTER_API_KEY: str = os.getenv("OPENROUTER_API_KEY", "")
    OPENROUTER_MODEL: str = os.getenv("OPENROUTER_MODEL", "openai/gpt-4o-mini")

settings = Settings()

