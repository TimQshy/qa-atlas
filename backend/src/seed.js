import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, '../data');
const DATA_FILE = path.join(DATA_DIR, 'product.json');

const mockData = {
  productName: 'My App',
  modules: [
    {
      id: 'mod-auth',
      name: 'Authentication',
      features: [
        {
          id: 'feat-login',
          name: 'Login',
          moduleId: 'mod-auth',
          coverage: 90,
          testCases: [
            { id: 'tc-1', name: 'Valid credentials', automated: true },
            { id: 'tc-2', name: 'Invalid password', automated: true },
            { id: 'tc-3', name: 'Lockout after 5 attempts', automated: false }
          ],
          tickets: [{ key: 'JIRA-100' }],
          bugs: [],
          automation: ['Valid credentials', 'Invalid password']
        },
        {
          id: 'feat-register',
          name: 'Register',
          moduleId: 'mod-auth',
          coverage: 85,
          testCases: [
            { id: 'tc-4', name: 'New user registration', automated: true },
            { id: 'tc-5', name: 'Duplicate email', automated: true }
          ],
          tickets: [],
          bugs: [{ key: 'BUG-201' }],
          automation: ['New user registration', 'Duplicate email']
        }
      ]
    },
    {
      id: 'mod-booking',
      name: 'Booking',
      features: [
        {
          id: 'feat-create',
          name: 'Create Booking',
          moduleId: 'mod-booking',
          coverage: 75,
          testCases: [
            { id: 'tc-6', name: 'Create single booking', automated: true },
            { id: 'tc-7', name: 'Create recurring booking', automated: false }
          ],
          tickets: [{ key: 'JIRA-301' }],
          bugs: [],
          automation: ['Create single booking']
        },
        {
          id: 'feat-cancel',
          name: 'Cancel Booking',
          moduleId: 'mod-booking',
          coverage: 60,
          testCases: [
            { id: 'tc-8', name: 'Cancel within 24h', automated: true },
            { id: 'tc-9', name: 'Cancel after 24h', automated: false }
          ],
          tickets: [],
          bugs: [],
          automation: ['Cancel within 24h']
        }
      ]
    },
    {
      id: 'mod-events',
      name: 'Event Forms',
      features: [
        {
          id: 'feat-submit',
          name: 'Submit Form',
          moduleId: 'mod-events',
          coverage: 66,
          testCases: [
            { id: 'tc-10', name: 'TC-01 Valid submission', automated: true },
            { id: 'tc-11', name: 'TC-02 Empty fields', automated: true },
            { id: 'tc-12', name: 'TC-03 Duplicate submission', automated: false }
          ],
          tickets: [{ key: 'JIRA-421' }],
          bugs: ['BUG-101', 'BUG-102'],
          automation: ['TC-01 Valid submission', 'TC-02 Empty fields']
        }
      ]
    },
    {
      id: 'mod-payments',
      name: 'Payments',
      features: [
        {
          id: 'feat-checkout',
          name: 'Checkout Flow',
          moduleId: 'mod-payments',
          coverage: 0,
          testCases: [],
          tickets: [],
          bugs: ['BUG-301', 'BUG-302', 'BUG-303', 'BUG-304', 'BUG-305', 'BUG-306', 'BUG-307', 'BUG-308', 'BUG-309', 'BUG-310', 'BUG-311', 'BUG-312'],
          automation: []
        }
      ]
    }
  ]
};

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}
fs.writeFileSync(DATA_FILE, JSON.stringify(mockData, null, 2), 'utf-8');
console.log('Seeded product.json with mock data.');
