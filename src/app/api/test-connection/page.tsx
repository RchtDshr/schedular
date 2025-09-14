import { createClient } from '@/utils/supabase/server';

export default async function TestConnection() {
  let connectionStatus = 'Testing...';
  let tableData: any = null;
  let error: string | null = null;

  try {
    const supabase = await createClient();
    
    // Test basic connection
    const { data: connectionTest, error: connectionError } = await supabase
      .from('quiet_blocks_events')
      .select('*')
      .limit(1);

    if (connectionError) {
      error = `Connection Error: ${connectionError.message}`;
      connectionStatus = 'Failed';
    } else {
      connectionStatus = 'Success';
      
      // Get table structure
      const { data: tableStructure, error: structureError } = await supabase
        .from('quiet_blocks_events')
        .select('*')
        .limit(5);

      if (structureError) {
        error = `Table Access Error: ${structureError.message}`;
      } else {
        tableData = tableStructure;
      }
    }
  } catch (err) {
    error = `Unexpected Error: ${err instanceof Error ? err.message : 'Unknown error'}`;
    connectionStatus = 'Failed';
  }

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">Supabase Connection Test</h1>
      
      <div className=" shadow-md rounded-lg p-6 mb-6">
        <h2 className="text-xl font-semibold mb-4">Connection Status</h2>
        <div className={`p-4 rounded ${
          connectionStatus === 'Success' 
            ? 'bg-green-100 text-green-800' 
            : connectionStatus === 'Failed'
            ? 'bg-red-100 text-red-800'
            : 'bg-yellow-100 text-yellow-800'
        }`}>
          Status: {connectionStatus}
        </div>
        
        {error && (
          <div className="mt-4 p-4 bg-red-100 text-red-800 rounded">
            <strong>Error:</strong> {error}
          </div>
        )}
      </div>

      <div className=" shadow-md rounded-lg p-6">
        <h2 className="text-xl font-semibold mb-4">Table: quiet_blocks_events</h2>
        
        {tableData && tableData.length > 0 ? (
          <div>
            <p className="mb-4 text-green-600">✅ Table found with {tableData.length} records (showing first 5)</p>
            <div className="overflow-x-auto">
              <pre className="bg-gray-100 p-4 rounded text-sm">
                {JSON.stringify(tableData, null, 2)}
              </pre>
            </div>
          </div>
        ) : tableData && tableData.length === 0 ? (
          <p className="text-yellow-600">⚠️ Table exists but is empty</p>
        ) : (
          <p className="text-red-600">❌ Cannot access table or table doesn't exist</p>
        )}
      </div>

      <div className="mt-6  p-4 rounded">
        <h3 className="font-semibold mb-2">Environment Check:</h3>
        <p>Supabase URL: {process.env.NEXT_PUBLIC_SUPABASE_URL ? '✅ Set' : '❌ Missing'}</p>
        <p>Supabase Key: {process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? '✅ Set' : '❌ Missing'}</p>
      </div>
    </div>
  );
}