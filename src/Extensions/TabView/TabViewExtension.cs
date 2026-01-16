using SwarmUI.Core;
using SwarmUI.Utils;

namespace TabView;

public class TabViewExtension: Extension
{
    public override void OnInit()
    {
        // Register Styles
        StyleSheetFiles.Add("Assets/tab_view.css");

        // Register Scripts (Order Matters!)
        // 1. Database & Utilities (Dependencies)
        ScriptFiles.Add("Assets/purview_db.js");
        
        // 2. Main Logic (Depends on DB)
        ScriptFiles.Add("Assets/purview_tab.js");
        

        // Add the tab HTML - but since it's file-based, assume it's loaded from Assets/Tabs/Text2Image/previewtab.html
        // No need to add here if using the folder structure
    }
}