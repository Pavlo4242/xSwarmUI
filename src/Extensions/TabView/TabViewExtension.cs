using SwarmUI.Core;
using SwarmUI.Utils;

namespace TabView;

public class TabViewExtension: Extension
{
    public override void OnInit()
    {
        // Register assets
        ScriptFiles.Add("Assets/TabView.js?v=221");
		StyleSheetFiles.Add("Assets/TabView.css?v=221");
        

        // Add the tab HTML - but since it's file-based, assume it's loaded from Assets/Tabs/Text2Image/previewtab.html
        // No need to add here if using the folder structure
    }
}
    