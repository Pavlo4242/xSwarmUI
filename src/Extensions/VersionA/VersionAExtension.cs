using SwarmUI.Core;
using SwarmUI.Utils;

namespace VersionA;

public class VersionAExtension: Extension
{
    public override void OnInit()
    {
        // Register assets
        ScriptFiles.Add("Assets/version_a.js");
		StyleSheetFiles.Add("Assets/version_a.css");
        

        // Add the tab HTML - but since it's file-based, assume it's loaded from Assets/Tabs/Text2Image/previewtab.html
        // No need to add here if using the folder structure
    }
}
    