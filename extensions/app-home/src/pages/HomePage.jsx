import {useState, useEffect} from 'preact/hooks';

// Helper to call Admin GraphQL through direct API access
async function adminGraphql(query, variables = {}) {
  const res = await fetch('shopify:admin/api/graphql.json', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({query, variables}),
  });
  const data = await res.json();
  if (data.errors && data.errors.length) {
    throw new Error(data.errors.map((e) => e.message).join('; '));
  }
  return data.data;
}

const CHECKLIST_STORAGE_KEY = 'crr_store_settings_checklist';

export default function HomePage() {
  // Section 1: Order fields state
  const [fieldStatus, setFieldStatus] = useState({
    loading: true,
    definition: null,
    statusText: 'Checking...',
    tone: 'info',
    error: '',
  });
  const [fixing, setFixing] = useState(false);
  const [setupFeedback, setSetupFeedback] = useState('');

  // Section 2: Store settings checklist state (persisted via localStorage)
  const [checklist, setChecklist] = useState({
    protectedData: false,
    selfServeOff: false,
    blockAdded: false,
    analyticsReport: false,
  });

  // Section 3: Recent requests state
  const [recentOrders, setRecentOrders] = useState([]);
  const [recentLoading, setRecentLoading] = useState(true);
  const [recentError, setRecentError] = useState('');

  // Load checklist from browser storage
  useEffect(() => {
    try {
      const saved = localStorage.getItem(CHECKLIST_STORAGE_KEY);
      if (saved) {
        setChecklist(JSON.parse(saved));
      }
    } catch (e) {
      console.warn('Could not read checklist from storage', e);
    }
  }, []);

  function toggleChecklist(key) {
    const updated = {...checklist, [key]: !checklist[key]};
    setChecklist(updated);
    try {
      localStorage.setItem(CHECKLIST_STORAGE_KEY, JSON.stringify(updated));
    } catch (e) {
      console.warn('Could not save checklist to storage', e);
    }
  }

  // Load order fields status
  async function checkOrderFields() {
    setFieldStatus((prev) => ({...prev, loading: true, error: ''}));
    try {
      const data = await adminGraphql(`
        query CheckOrderMetafields {
          metafieldDefinitions(ownerType: ORDER, namespace: "custom", key: "return_reason", first: 1) {
            nodes {
              id
              name
              key
              namespace
              type {
                name
              }
              access {
                customerAccount
              }
              capabilities {
                adminFilterable {
                  enabled
                }
                analyticsQueryable {
                  enabled
                  eligible
                }
              }
            }
          }
        }
      `);

      const def = data?.metafieldDefinitions?.nodes?.[0];
      if (!def) {
        setFieldStatus({
          loading: false,
          definition: null,
          statusText: 'Missing',
          tone: 'warning',
          error: '',
        });
        return;
      }

      // Evaluate status
      if (def.type?.name !== 'single_line_text_field') {
        setFieldStatus({
          loading: false,
          definition: def,
          statusText: 'Wrong type (requires single_line_text_field)',
          tone: 'critical',
          error: `Current type is "${def.type?.name}". Type cannot be changed via API. Please delete or rename the conflicting definition manually in Settings > Custom data > Orders.`,
        });
      } else if (def.access?.customerAccount !== 'READ_WRITE') {
        setFieldStatus({
          loading: false,
          definition: def,
          statusText: 'Wrong access (Customer Account needs READ_WRITE)',
          tone: 'warning',
          error: '',
        });
      } else if (!def.capabilities?.analyticsQueryable?.enabled) {
        if (!def.capabilities?.analyticsQueryable?.eligible) {
          setFieldStatus({
            loading: false,
            definition: def,
            statusText: 'Analytics not available on store plan',
            tone: 'info',
            error: '',
          });
        } else {
          setFieldStatus({
            loading: false,
            definition: def,
            statusText: 'Analytics capability off',
            tone: 'warning',
            error: '',
          });
        }
      } else {
        setFieldStatus({
          loading: false,
          definition: def,
          statusText: 'Ready',
          tone: 'success',
          error: '',
        });
      }
    } catch (err) {
      setFieldStatus({
        loading: false,
        definition: null,
        statusText: 'Error checking field',
        tone: 'critical',
        error: err.message || String(err),
      });
    }
  }

  // Idempotent "Set up" button
  async function setupOrderFields() {
    setFixing(true);
    setSetupFeedback('');
    try {
      if (!fieldStatus.definition) {
        // Missing -> create
        const res = await adminGraphql(`
          mutation CreateReturnReasonDef($definition: MetafieldDefinitionInput!) {
            metafieldDefinitionCreate(definition: $definition) {
              createdDefinition {
                id
                name
                key
              }
              userErrors {
                field
                message
              }
            }
          }
        `, {
          definition: {
            name: 'Return reason',
            namespace: 'custom',
            key: 'return_reason',
            type: 'single_line_text_field',
            ownerType: 'ORDER',
            access: {
              customerAccount: 'READ_WRITE',
              storefront: 'NONE',
            },
            capabilities: {
              adminFilterable: {
                enabled: true,
              },
              analyticsQueryable: {
                enabled: true,
              },
            },
          },
        });

        const userErrors = res?.metafieldDefinitionCreate?.userErrors || [];
        if (userErrors.length) {
          setSetupFeedback(`Error: ${userErrors.map((e) => e.message).join(' ')}`);
        } else {
          setSetupFeedback('Successfully created custom.return_reason!');
          await checkOrderFields();
        }
      } else {
        // Exists: if wrong type, do not alter
        if (fieldStatus.definition.type?.name !== 'single_line_text_field') {
          setSetupFeedback('Cannot change type automatically. Please resolve the type conflict in Settings > Custom data > Orders.');
          setFixing(false);
          return;
        }

        // Wrong access / capabilities -> update
        const res = await adminGraphql(`
          mutation UpdateReturnReasonDef($definition: MetafieldDefinitionUpdateInput!) {
            metafieldDefinitionUpdate(definition: $definition) {
              updatedDefinition {
                id
                name
              }
              userErrors {
                field
                message
              }
            }
          }
        `, {
          definition: {
            id: fieldStatus.definition.id,
            access: {
              customerAccount: 'READ_WRITE',
              storefront: 'NONE',
            },
            capabilities: {
              adminFilterable: {
                enabled: true,
              },
              analyticsQueryable: {
                enabled: true,
              },
            },
          },
        });

        const userErrors = res?.metafieldDefinitionUpdate?.userErrors || [];
        if (userErrors.length) {
          setSetupFeedback(`Error: ${userErrors.map((e) => e.message).join(' ')}`);
        } else {
          setSetupFeedback('Successfully updated custom.return_reason!');
          await checkOrderFields();
        }
      }
    } catch (err) {
      setSetupFeedback(`Setup error: ${err.message || String(err)}`);
    } finally {
      setFixing(false);
    }
  }

  // Load recent requests (latest 10 orders with return reason)
  async function loadRecentRequests() {
    setRecentLoading(true);
    setRecentError('');
    try {
      const data = await adminGraphql(`
        query GetRecentReturnOrders {
          orders(first: 25, sortKey: CREATED_AT, reverse: true) {
            nodes {
              id
              name
              createdAt
              reasonMetafield: metafield(namespace: "custom", key: "return_reason") {
                value
              }
              appStatusMetafield: metafield(namespace: "$app", key: "return_status") {
                value
              }
              legacyStatusMetafield: metafield(namespace: "custom", key: "return_status") {
                value
              }
            }
          }
        }
      `);

      const all = data?.orders?.nodes || [];
      const withReason = all
        .filter((o) => o.reasonMetafield?.value)
        .slice(0, 10)
        .map((o) => ({
          id: o.id,
          name: o.name,
          date: o.createdAt.slice(0, 10),
          reason: o.reasonMetafield?.value,
          status: o.appStatusMetafield?.value || o.legacyStatusMetafield?.value || 'Pending',
          adminUrl: `shopify:admin/orders/${o.id.split('/').pop()}`,
        }));

      setRecentOrders(withReason);
    } catch (err) {
      setRecentError(err.message || String(err));
    } finally {
      setRecentLoading(false);
    }
  }

  useEffect(() => {
    checkOrderFields();
    loadRecentRequests();
  }, []);

  return (
    <s-page heading="Setup & Health Check">
      {/* Section 1: Order fields (Automatic) */}
      <s-section heading="1. Order Fields">
        <s-stack direction="block" gap="base">
          <s-paragraph>
            Verification and setup of order metafields. The app manages its own data fields in TOML, while <code>custom.return_reason</code> is merchant-owned to support native Shopify Analytics.
          </s-paragraph>

          <s-table>
            <s-table-header-row>
              <s-table-header>Field</s-table-header>
              <s-table-header>Ownership</s-table-header>
              <s-table-header>Status</s-table-header>
            </s-table-header-row>
            <s-table-body>
              <s-table-row>
                <s-table-cell>
                  <s-text type="strong">custom.return_reason</s-text>
                </s-table-cell>
                <s-table-cell>Merchant-owned (Analytics)</s-table-cell>
                <s-table-cell>
                  <s-badge tone={fieldStatus.tone}>{fieldStatus.statusText}</s-badge>
                </s-table-cell>
              </s-table-row>
              <s-table-row>
                <s-table-cell>
                  <s-text type="strong">$app:return_request</s-text>
                </s-table-cell>
                <s-table-cell>Managed by app (TOML)</s-table-cell>
                <s-table-cell>
                  <s-badge tone="success">Ready</s-badge>
                </s-table-cell>
              </s-table-row>
              <s-table-row>
                <s-table-cell>
                  <s-text type="strong">$app:return_data</s-text>
                </s-table-cell>
                <s-table-cell>Managed by app (TOML)</s-table-cell>
                <s-table-cell>
                  <s-badge tone="success">Ready</s-badge>
                </s-table-cell>
              </s-table-row>
              <s-table-row>
                <s-table-cell>
                  <s-text type="strong">$app:return_status</s-text>
                </s-table-cell>
                <s-table-cell>Managed by app (TOML)</s-table-cell>
                <s-table-cell>
                  <s-badge tone="success">Ready</s-badge>
                </s-table-cell>
              </s-table-row>
            </s-table-body>
          </s-table>

          {fieldStatus.error ? (
            <s-banner tone="critical">
              <s-text>{fieldStatus.error}</s-text>
            </s-banner>
          ) : null}

          {setupFeedback ? (
            <s-banner tone={setupFeedback.startsWith('Error') ? 'critical' : 'success'}>
              <s-text>{setupFeedback}</s-text>
            </s-banner>
          ) : null}

          <s-stack direction="inline" gap="base">
            <s-button
              disabled={fixing || fieldStatus.loading || fieldStatus.statusText === 'Ready'}
              variant="primary"
              onClick={setupOrderFields}
            >
              {fixing ? 'Setting up...' : fieldStatus.statusText === 'Ready' ? 'Already Set Up' : 'Set Up custom.return_reason'}
            </s-button>
            <s-button disabled={fieldStatus.loading} onClick={checkOrderFields}>
              Re-check Fields
            </s-button>
          </s-stack>
        </s-stack>
      </s-section>

      {/* Section 2: Store settings (Manual Checklist) */}
      <s-section heading="2. Store Settings Checklist">
        <s-stack direction="block" gap="base">
          <s-paragraph>
            These store settings cannot be automated via API and must be configured in Shopify admin. Check off each item as a reminder (remembered in browser storage).
          </s-paragraph>

          <s-stack direction="block" gap="small-200">
            <s-stack direction="inline" gap="small" alignItems="center">
              <s-checkbox
                accessibilityLabel="Protected customer data approved"
                checked={checklist.protectedData}
                onChange={() => toggleChecklist('protectedData')}
              />
              <s-text type="strong">Protected customer data approved</s-text>
            </s-stack>
            <s-paragraph color="subdued">
              App configuration requires Level 1 access for Customer Account queries.{' '}
              <s-link href="https://partners.shopify.com" target="_blank">
                Partner Dashboard
              </s-link>
            </s-paragraph>
          </s-stack>

          <s-divider />

          <s-stack direction="block" gap="small-200">
            <s-stack direction="inline" gap="small" alignItems="center">
              <s-checkbox
                accessibilityLabel="Self-serve returns and cancellations is OFF"
                checked={checklist.selfServeOff}
                onChange={() => toggleChecklist('selfServeOff')}
              />
              <s-text type="strong">Self-serve returns and cancellations is OFF</s-text>
            </s-stack>
            <s-paragraph color="subdued">
              Turn off Shopify's native self-serve returns to allow custom return reasons to control return requests.{' '}
              <s-link href="shopify:admin/settings/customer_accounts" target="_blank">
                Settings &gt; Customer accounts
              </s-link>
            </s-paragraph>
          </s-stack>

          <s-divider />

          <s-stack direction="block" gap="small-200">
            <s-stack direction="inline" gap="small" alignItems="center">
              <s-checkbox
                accessibilityLabel="Custom return reasons block added"
                checked={checklist.blockAdded}
                onChange={() => toggleChecklist('blockAdded')}
              />
              <s-text type="strong">"Custom return reasons" block added to "Orders and Order status"</s-text>
            </s-stack>
            <s-paragraph color="subdued">
              Add the extension block to the customer account page editor.{' '}
              <s-link href="shopify:admin/settings/customer_accounts" target="_blank">
                Settings &gt; Customer accounts &gt; Customize
              </s-link>
            </s-paragraph>
          </s-stack>

          <s-divider />

          <s-stack direction="block" gap="small-200">
            <s-stack direction="inline" gap="small" alignItems="center">
              <s-checkbox
                accessibilityLabel="Optional: Analytics report created"
                checked={checklist.analyticsReport}
                onChange={() => toggleChecklist('analyticsReport')}
              />
              <s-text type="strong">Optional: Analytics report "Orders by return reason" created</s-text>
            </s-stack>
            <s-paragraph color="subdued">
              In Shopify Analytics, create a custom report starting from Orders and group by "Return reason".{' '}
              <s-link href="shopify:admin/analytics/reports" target="_blank">
                Analytics &gt; Reports
              </s-link>
            </s-paragraph>
          </s-stack>
        </s-stack>
      </s-section>

      {/* Section 3: Recent requests (Read-only) */}
      <s-section heading="3. Recent Requests">
        <s-stack direction="block" gap="base">
          <s-paragraph>
            Latest orders with return requests submitted by customers.
          </s-paragraph>

          {recentLoading ? (
            <s-stack direction="inline" gap="base" alignItems="center">
              <s-spinner accessibilityLabel="Loading recent requests" />
              <s-text color="subdued">Loading orders...</s-text>
            </s-stack>
          ) : recentError ? (
            <s-banner tone="critical">
              <s-text>{recentError}</s-text>
            </s-banner>
          ) : recentOrders.length === 0 ? (
            <s-banner tone="info">
              <s-text>No orders with return requests found yet.</s-text>
            </s-banner>
          ) : (
            <s-table>
              <s-table-header-row>
                <s-table-header>Order</s-table-header>
                <s-table-header>Date</s-table-header>
                <s-table-header>Reason</s-table-header>
                <s-table-header>Status</s-table-header>
              </s-table-header-row>
              <s-table-body>
                {recentOrders.map((o) => (
                  <s-table-row key={o.id}>
                    <s-table-cell>
                      <s-link href={o.adminUrl} target="_blank">
                        {o.name}
                      </s-link>
                    </s-table-cell>
                    <s-table-cell>{o.date}</s-table-cell>
                    <s-table-cell>{o.reason}</s-table-cell>
                    <s-table-cell>
                      <s-badge>{o.status}</s-badge>
                    </s-table-cell>
                  </s-table-row>
                ))}
              </s-table-body>
            </s-table>
          )}

          <s-stack direction="inline" gap="base">
            <s-button disabled={recentLoading} onClick={loadRecentRequests}>
              Refresh Recent Requests
            </s-button>
          </s-stack>
        </s-stack>
      </s-section>
    </s-page>
  );
}
