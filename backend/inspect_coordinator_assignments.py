
from sqlalchemy import inspect, text
from app.core.database import engine

TABLE = "coordinator_student_assignments"


def main():
    with engine.connect() as connection:
        inspector = inspect(connection)

        if not inspector.has_table(TABLE):
            print(f"Table '{TABLE}' does not exist.")
            return

        print("\n=== EXISTING COLUMNS ===")
        for column in inspector.get_columns(TABLE):
            print(
                column["name"],
                column["type"],
                "nullable =", column["nullable"]
            )

        print("\n=== UNIQUE CONSTRAINTS ===")
        for constraint in inspector.get_unique_constraints(TABLE):
            print(constraint)

        print("\n=== INDEXES ===")
        for index in inspector.get_indexes(TABLE):
            print(index)

        print("\n=== ASSIGNMENT COUNT ===")
        count = connection.execute(
            text(f"SELECT COUNT(*) FROM {TABLE}")
        ).scalar()
        print(count)

        print("\n=== EXISTING ASSIGNMENTS ===")
        columns = {
            column["name"]
            for column in inspector.get_columns(TABLE)
        }

        selected = [
            name for name in (
                "id",
                "coordinator_id",
                "student_id",
                "academic_year",
                "semester",
                "created_at",
            )
            if name in columns
        ]

        if selected:
            query = (
                f"SELECT {', '.join(selected)} "
                f"FROM {TABLE} LIMIT 20"
            )

            rows = connection.execute(text(query))

            for row in rows:
                print(dict(row._mapping))


if __name__ == "__main__":
    main()
