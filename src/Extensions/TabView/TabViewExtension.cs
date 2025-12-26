
using SwarmUI.Core;
using SwarmUI.Utils;

namespace TabView;

public class TabViewExtension: Extension
{
    public override void OnInit()
    {
        // Register assets
        StyleSheetFiles.Add("Assets/matti.css?v=15");
        ScriptFiles.Add("Assets/matti.js?v=15");

        // Add the tab HTML - but since it's file-based, assume it's loaded from Assets/Tabs/Text2Image/previewtab.html
        // No need to add here if using the folder structure
    }
}
    