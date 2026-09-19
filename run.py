import os
from app import create_app

app = create_app()

if __name__ == "__main__":
    port = int(os.getenv("PORT", 5000))
    print(f"\n=======================================================")
    print(f"   LEDGER - Your Personal Financial Operating System   ")
    print(f"   Server running at: http://localhost:{port}           ")
    print(f"=======================================================\n")
    app.run(host="127.0.0.1", port=port, debug=True)
