import requests
import sys
from datetime import datetime, timedelta
import json

class FinanceAppTester:
    def __init__(self, base_url="https://money-tracker-2610.preview.emergentagent.com"):
        self.base_url = base_url
        self.token = None
        self.user_id = None
        self.tests_run = 0
        self.tests_passed = 0
        self.category_ids = {}
        self.transaction_ids = []
        self.goal_ids = []

    def run_test(self, name, method, endpoint, expected_status, data=None):
        """Run a single API test"""
        url = f"{self.base_url}/api/{endpoint}"
        headers = {'Content-Type': 'application/json'}
        if self.token:
            headers['Authorization'] = f'Bearer {self.token}'

        self.tests_run += 1
        print(f"\n🔍 Testing {name}...")
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=headers)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=headers)
            elif method == 'PUT':
                response = requests.put(url, json=data, headers=headers)
            elif method == 'DELETE':
                response = requests.delete(url, headers=headers)

            success = response.status_code == expected_status
            if success:
                self.tests_passed += 1
                print(f"✅ Passed - Status: {response.status_code}")
                try:
                    return success, response.json()
                except:
                    return success, {}
            else:
                print(f"❌ Failed - Expected {expected_status}, got {response.status_code}")
                try:
                    error_data = response.json()
                    print(f"   Error: {error_data}")
                except:
                    print(f"   Response: {response.text}")
                return False, {}

        except Exception as e:
            print(f"❌ Failed - Error: {str(e)}")
            return False, {}

    # Auth Tests
    def test_register(self):
        """Test user registration"""
        test_data = {
            "name": "Test User Finance",
            "email": "testuser@financeapp.com", 
            "password": "test123456"
        }
        
        success, response = self.run_test(
            "User Registration",
            "POST",
            "auth/register",
            200,
            data=test_data
        )
        
        if success and 'access_token' in response and 'user' in response:
            self.token = response['access_token']
            self.user_id = response['user']['id']
            print(f"   Token obtained: {self.token[:20]}...")
            print(f"   User ID: {self.user_id}")
            return True
        return False

    def test_login(self):
        """Test user login"""
        success, response = self.run_test(
            "User Login",
            "POST",
            "auth/login",
            200,
            data={"email": "testuser@financeapp.com", "password": "test123456"}
        )
        
        if success and 'access_token' in response:
            if not self.token:  # Only update if we don't have token from registration
                self.token = response['access_token']
                self.user_id = response['user']['id']
        return success

    def test_get_me(self):
        """Test get current user"""
        success, response = self.run_test(
            "Get Current User",
            "GET", 
            "auth/me",
            200
        )
        return success and 'id' in response

    # Category Tests
    def test_get_categories(self):
        """Test get categories"""
        success, response = self.run_test(
            "Get Categories",
            "GET",
            "categories", 
            200
        )
        
        if success and isinstance(response, list):
            # Store category IDs for later use
            for cat in response:
                self.category_ids[cat['name']] = cat['id']
            print(f"   Found {len(response)} default categories")
        return success

    def test_create_category(self):
        """Test create custom category"""
        success, response = self.run_test(
            "Create Category",
            "POST",
            "categories",
            200,
            data={
                "name": "Teste Custom",
                "type": "expense", 
                "icon": "test",
                "color": "#FF5733"
            }
        )
        
        if success and 'id' in response:
            self.category_ids['Teste Custom'] = response['id']
        return success

    # Transaction Tests
    def test_create_income_transaction(self):
        """Test create income transaction"""
        income_category = next((cid for cname, cid in self.category_ids.items() 
                               if 'Salário' in cname), list(self.category_ids.values())[0])
        
        success, response = self.run_test(
            "Create Income Transaction",
            "POST",
            "transactions",
            200,
            data={
                "description": "Salário Teste",
                "amount": 5000.00,
                "type": "income",
                "category_id": income_category,
                "date": datetime.now().isoformat()
            }
        )
        
        if success and 'id' in response:
            self.transaction_ids.append(response['id'])
        return success

    def test_create_expense_transaction(self):
        """Test create expense transaction"""
        expense_category = next((cid for cname, cid in self.category_ids.items() 
                               if 'Alimentação' in cname), list(self.category_ids.values())[0])
        
        success, response = self.run_test(
            "Create Expense Transaction",
            "POST",
            "transactions", 
            200,
            data={
                "description": "Almoço Teste",
                "amount": 25.50,
                "type": "expense",
                "category_id": expense_category,
                "date": datetime.now().isoformat()
            }
        )
        
        if success and 'id' in response:
            self.transaction_ids.append(response['id'])
        return success

    def test_get_transactions(self):
        """Test get transactions"""
        success, response = self.run_test(
            "Get Transactions",
            "GET",
            "transactions",
            200
        )
        
        if success:
            print(f"   Found {len(response)} transactions")
        return success

    def test_filter_transactions(self):
        """Test filter transactions by type"""
        success_income, _ = self.run_test(
            "Filter Income Transactions", 
            "GET",
            "transactions?type=income",
            200
        )
        
        success_expense, _ = self.run_test(
            "Filter Expense Transactions",
            "GET", 
            "transactions?type=expense",
            200
        )
        
        return success_income and success_expense

    def test_update_transaction(self):
        """Test update transaction"""
        if not self.transaction_ids:
            return False
            
        success, response = self.run_test(
            "Update Transaction",
            "PUT",
            f"transactions/{self.transaction_ids[0]}",
            200,
            data={"description": "Salário Atualizado"}
        )
        return success

    # Goal Tests  
    def test_create_goal(self):
        """Test create savings goal"""
        success, response = self.run_test(
            "Create Savings Goal",
            "POST",
            "goals",
            200,
            data={
                "name": "Viagem para Europa",
                "target_amount": 10000.00,
                "current_amount": 500.00,
                "deadline": (datetime.now() + timedelta(days=365)).isoformat()
            }
        )
        
        if success and 'id' in response:
            self.goal_ids.append(response['id'])
            print(f"   Goal progress: {response.get('progress', 0)}%")
        return success

    def test_get_goals(self):
        """Test get goals"""
        success, response = self.run_test(
            "Get Goals",
            "GET",
            "goals",
            200
        )
        
        if success:
            print(f"   Found {len(response)} goals")
        return success

    def test_update_goal(self):
        """Test add amount to goal"""
        if not self.goal_ids:
            return False
            
        success, response = self.run_test(
            "Add Amount to Goal",
            "PUT",
            f"goals/{self.goal_ids[0]}",
            200,
            data={"current_amount": 1000.00}
        )
        
        if success:
            print(f"   Updated goal progress: {response.get('progress', 0)}%")
        return success

    # Dashboard Tests
    def test_dashboard_stats(self):
        """Test dashboard statistics"""
        success, response = self.run_test(
            "Get Dashboard Stats",
            "GET",
            "dashboard/stats",
            200
        )
        
        if success:
            stats = response
            print(f"   Balance: R$ {stats.get('total_balance', 0):.2f}")
            print(f"   Income: R$ {stats.get('total_income', 0):.2f}")  
            print(f"   Expenses: R$ {stats.get('total_expenses', 0):.2f}")
            print(f"   Transactions: {stats.get('transactions_count', 0)}")
            print(f"   Goals: {stats.get('goals_count', 0)}")
        return success

    # AI Tips Tests
    def test_ai_tips(self):
        """Test AI financial tips"""
        success, response = self.run_test(
            "Get AI Financial Tip",
            "POST", 
            "ai/tips",
            200,
            data={"question": "Como posso economizar mais dinheiro?"}
        )
        
        if success:
            print(f"   AI Tip: {response.get('tip', '')[:100]}...")
            print(f"   Context: {response.get('context', '')}")
        return success

    # Cleanup
    def cleanup(self):
        """Clean up test data"""
        print("\n🧹 Cleaning up test data...")
        
        # Delete transactions
        for tid in self.transaction_ids:
            self.run_test(f"Delete Transaction {tid}", "DELETE", f"transactions/{tid}", 200)
        
        # Delete goals  
        for gid in self.goal_ids:
            self.run_test(f"Delete Goal {gid}", "DELETE", f"goals/{gid}", 200)

        # Delete custom categories
        if 'Teste Custom' in self.category_ids:
            self.run_test("Delete Custom Category", "DELETE", f"categories/{self.category_ids['Teste Custom']}", 200)

def main():
    print("🚀 Starting Finance App Backend Tests...")
    tester = FinanceAppTester()
    
    try:
        # Test sequence
        tests = [
            # Auth flow
            ("Registration", tester.test_register),
            ("Login", tester.test_login), 
            ("Get Current User", tester.test_get_me),
            
            # Categories
            ("Get Categories", tester.test_get_categories),
            ("Create Category", tester.test_create_category),
            
            # Transactions  
            ("Create Income Transaction", tester.test_create_income_transaction),
            ("Create Expense Transaction", tester.test_create_expense_transaction),
            ("Get Transactions", tester.test_get_transactions),
            ("Filter Transactions", tester.test_filter_transactions),
            ("Update Transaction", tester.test_update_transaction),
            
            # Goals
            ("Create Goal", tester.test_create_goal),
            ("Get Goals", tester.test_get_goals),
            ("Update Goal", tester.test_update_goal),
            
            # Dashboard
            ("Dashboard Stats", tester.test_dashboard_stats),
            
            # AI Tips
            ("AI Financial Tips", tester.test_ai_tips),
        ]
        
        # Run all tests
        for test_name, test_func in tests:
            if not test_func():
                print(f"⚠️  Test '{test_name}' failed - continuing with remaining tests")
        
        # Cleanup
        tester.cleanup()
        
        # Results
        print(f"\n📊 Test Results: {tester.tests_passed}/{tester.tests_run} tests passed")
        
        if tester.tests_passed == tester.tests_run:
            print("🎉 All tests passed!")
            return 0
        else:
            print("❌ Some tests failed")
            return 1
            
    except Exception as e:
        print(f"💥 Test suite failed: {str(e)}")
        return 1

if __name__ == "__main__":
    sys.exit(main())