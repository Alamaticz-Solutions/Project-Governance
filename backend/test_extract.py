import requests

url = "http://localhost:8000/api/v1/projects/extract-intake"
file_path = "c:/Users/VijayGanesam/Documents/Project Governace/sample_project_proposal.txt"

# For this test we need an auth token if the endpoint requires auth.
# Let's check if the endpoint is protected. Yes, `current_user: User = Depends(get_current_user)`.
# We can login first to get the token.
login_url = "http://localhost:8000/api/v1/auth/login"
login_data = {
    "username": "admin@projectgov.com", # assuming this exists based on previous conversations or we can just try to hit it
    "password": "admin"
}

# Actually, if we don't know credentials, it's better to just check the code of `projects.py` and see what might be wrong, or I can remove the auth requirement temporarily for testing, or I can check the backend logs.
