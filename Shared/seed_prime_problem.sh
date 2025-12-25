#!/bin/bash

# 1. Sign In as Admin (or Create if not exists)
# Try to create first
curl -s -X POST http://localhost:3001/api/v1/auth/signup \
  -H "Content-Type: application/json" \
  -d '{"username": "admin_prime", "email": "admin_prime@codewarz.com", "password": "password123", "role": "admin"}' > /dev/null

# Sign In
LOGIN_RES=$(curl -s -X POST http://localhost:3001/api/v1/auth/signin \
  -H "Content-Type: application/json" \
  -d '{"email": "admin_prime@codewarz.com", "password": "password123"}')

TOKEN=$(echo $LOGIN_RES | jq -r .accessToken)

if [ "$TOKEN" == "null" ]; then
  echo "Failed to login as admin. Response: $LOGIN_RES"
  exit 1
fi

echo "Authenticated as Admin."

# 2. Create Prime Problem
echo "Creating Prime Number Problem..."

curl -s -X POST http://localhost:3001/api/v1/problems \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Check Prime",
    "slug": "check-prime",
    "description": "Write a program that takes an integer N as input and prints \"true\" if N is a prime number, and \"false\" otherwise.\n\nInput Format:\nA single integer N.\n\nOutput Format:\nPrint \"true\" or \"false\".\n\nConstraints:\n1 <= N <= 10^9",
    "difficulty": "EASY",
    "timeLimitMs": 1000,
    "memoryLimitMb": 256,
    "testcases": [
      {
        "input": "2",
        "output": "true",
        "isSample": true
      },
      {
        "input": "4",
        "output": "false",
        "isSample": true
      },
      {
        "input": "7",
        "output": "true"
      },
      {
        "input": "1",
        "output": "false"
      },
      {
        "input": "100",
        "output": "false"
      },
      {
        "input": "97",
        "output": "true"
      }
    ]
  }' | jq .
