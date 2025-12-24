const { Queue } = require("bullmq");
const IORedis = require("ioredis");

const redis = new IORedis("redis://127.0.0.1:6379");
const queue = new Queue("submission-queue", { connection: redis });

(async () => {
    await queue.add("binary-search-hard", {
        submissionId: "sub_bs_001",
        userId: "user_89",
        contestId: "contest_1",
        language: "cpp",
        code: `
#include <bits/stdc++.h>
using namespace std;

int firstPos(vector<int>& a, int x){
    int l = 0, r = a.size() - 1, ans = -1;
    while(l <= r){
        int m = l + (r - l) / 2;
        if(a[m] >= x){
            if(a[m] == x) ans = m;
            r = m - 1;
        } else {
            l = m + 1;
        }
    }
    return ans;
}

int lastPos(vector<int>& a, int x){
    int l = 0, r = a.size() - 1, ans = -1;
    while(l <= r){
        int m = l + (r - l) / 2;
        if(a[m] <= x){
            if(a[m] == x) ans = m;
            l = m + 1;
        } else {
            r = m - 1;
        }
    }
    return ans;
}

int main(){
    ios::sync_with_stdio(false);
    cin.tie(NULL);

    int T; cin >> T;
    while(T--){
        int n; cin >> n;
        vector<int> a(n);
        for(int i = 0; i < n; i++) cin >> a[i];
        int target; cin >> target;

        int f = firstPos(a, target);
        int l = lastPos(a, target);
        cout << f << " " << l << "\\n";
    }
    return 0;
}
`,

        testcases: [
            {
                input: `1
8
1 2 2 2 3 4 5 6
2`,
                output: `1 3`
            },
            {
                input: `1
5
1 2 3 4 5
6`,
                output: `-1 -1`
            },
            {
                input: `1
6
2 2 2 2 2 2
2`,
                output: `0 5`
            },
            {
                input: `1
1
10
10`,
                output: `0 0`
            },
            {
                input: `1
7
1 3 3 3 3 5 7
3`,
                output: `1 4`
            },
            {
                input: `1
7
1 3 3 3 3 5 7
4`,
                output: `-1 -1`
            },
            {
                input: `1
10
1 1 1 1 1 1 1 1 1 1
1`,
                output: `0 9`
            },
            {
                input: `1
5
-10 -5 -5 0 5
-5`,
                output: `1 2`
            }
        ],

        constraints: {
            timeLimitMs: 3000,
            memoryLimitMb: 256,
            cpuLimit: 1
        }
    });

    console.log("Binary Search job pushed");
    process.exit(0);
})();
