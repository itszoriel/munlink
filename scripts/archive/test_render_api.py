"""Test Render API after deployment."""
import requests
import time

API_URL = "https://munlink-api-9c02.onrender.com"


def run_single_test():
    """Run single test of all endpoints."""
    print("=" * 60)
    print("Testing Render API")
    print("=" * 60)

    # Test 1: Health endpoint
    print("\n[1] Testing /health...")
    start = time.time()
    try:
        r = requests.get(f"{API_URL}/health", timeout=30)
        print(f"    Status: {r.status_code}, Time: {time.time()-start:.2f}s")
    except Exception as e:
        print(f"    FAILED: {e}")

    # Test 2: Database health endpoint
    print("\n[2] Testing /health/db (database connectivity)...")
    start = time.time()
    try:
        r = requests.get(f"{API_URL}/health/db", timeout=60)
        print(f"    Status: {r.status_code}, Time: {time.time()-start:.2f}s")
        if r.status_code == 200:
            data = r.json()
            print(f"    DB: {data.get('database')}, Latency: {data.get('latency_ms')}ms")
        else:
            print(f"    Response: {r.text[:200]}")
    except Exception as e:
        print(f"    FAILED: {e}")

    # Test 3: Provinces endpoint
    print("\n[3] Testing /api/provinces...")
    start = time.time()
    try:
        r = requests.get(f"{API_URL}/api/provinces", timeout=90)
        print(f"    Status: {r.status_code}, Time: {time.time()-start:.2f}s")
        if r.status_code == 200:
            data = r.json()
            print(f"    Provinces found: {data.get('count', '?')}")
        else:
            print(f"    Response: {r.text[:200]}")
    except Exception as e:
        print(f"    FAILED: {e}")

    print("\n" + "=" * 60)


def run_stability_test(endpoint="/api/provinces", iterations=5):
    """Run multiple tests on an endpoint."""
    print(f"\nStability test: {endpoint} ({iterations} iterations)")
    print("-" * 50)
    
    successes = 0
    failures = 0
    times = []
    
    for i in range(iterations):
        start = time.time()
        try:
            r = requests.get(f"{API_URL}{endpoint}", timeout=60)
            elapsed = time.time() - start
            if r.status_code == 200:
                successes += 1
                times.append(elapsed)
                print(f"  [{i+1}/{iterations}] OK - {elapsed:.2f}s")
            else:
                failures += 1
                print(f"  [{i+1}/{iterations}] ERR {r.status_code} - {elapsed:.2f}s")
        except Exception as e:
            failures += 1
            elapsed = time.time() - start
            print(f"  [{i+1}/{iterations}] FAIL - {elapsed:.2f}s")
        time.sleep(1)
    
    print("-" * 50)
    print(f"Results: {successes} success, {failures} failures")
    if times:
        print(f"Avg time: {sum(times)/len(times):.2f}s")


if __name__ == "__main__":
    import sys
    
    if len(sys.argv) > 1 and sys.argv[1] == "stability":
        run_stability_test(iterations=5)
    else:
        run_single_test()

