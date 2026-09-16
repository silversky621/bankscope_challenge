"""Daily numeric tickets shared with Spring; caller commits with the task insert."""


def allocate_ticket_number(cursor):
    # Capture the day once, so issuing across midnight cannot select another day's row.
    cursor.execute("SELECT NOW() AS issued_at")
    issued_at = cursor.fetchone()['issued_at']
    ticket_date = issued_at.date()
    cursor.execute(
        "INSERT INTO task_ticket_sequence (ticket_date, last_number) VALUES (%s, 1) "
        "ON DUPLICATE KEY UPDATE last_number = last_number + 1",
        (ticket_date,),
    )
    cursor.execute("SELECT last_number FROM task_ticket_sequence WHERE ticket_date = %s", (ticket_date,))
    return str(cursor.fetchone()['last_number']), issued_at
