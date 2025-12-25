#!/bin/bash

# Configuration
PROBLEM_ID="db17c323-6baa-484f-8812-9f817f7bf9ea"
BASE_URL="http://localhost:3001/api/v1"

# Generate unique user
TIMESTAMP=$(date +%s)
USERNAME="prime_user_$TIMESTAMP"
EMAIL="prime_$TIMESTAMP@test.com"
PASSWORD="password123"

echo "1. Signing Up User ($USERNAME)..."
curl -s -X POST $BASE_URL/auth/signup \
  -H "Content-Type: application/json" \
  -d '{"username": "'$USERNAME'", "email": "'$EMAIL'", "password": "'$PASSWORD'"}' > /dev/null

echo "2. Signing In..."
LOGIN_RES=$(curl -s -X POST $BASE_URL/auth/signin \
  -H "Content-Type: application/json" \
  -d '{"email": "'$EMAIL'", "password": "'$PASSWORD'"}')

TOKEN=$(echo $LOGIN_RES | jq -r .accessToken)

# Get User ID
ME_RES=$(curl -s -X GET $BASE_URL/auth/me \
  -H "Authorization: Bearer $TOKEN")
USER_ID=$(echo $ME_RES | jq -r .user.id)

echo "   User ID: $USER_ID"

echo "3. Submitting Solution..."
# Submitting a "Dummy" Correct Solution (AC)
SUBMISSION_RES=$(curl -s -X POST $BASE_URL/submissions \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "'$USER_ID'",
    "problemId": "'$PROBLEM_ID'",
    "language": "cpp",
    "code": "#include <iostream>\nusing namespace std;\nbool isPrime(int n){if(n<=1)return false;for(int i=2;i*i<=n;i++)if(n%i==0)return false;return true;}\nint main(){int n;cin>>n;cout<<(isPrime(n)?\"true\":\"false\");return 0;}",
    "verdict": "AC",
    "passedTestcases": 6,
    "totalTestcases": 6,
    "timeTakenMs": 15,
    "score": 100
  }')

echo $SUBMISSION_RES | jq .
